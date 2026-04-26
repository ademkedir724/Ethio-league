import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth, isAuthError } from "@/lib/auth";
import { success, created, badRequest, serverError } from "@/lib/api-helpers";
import { assertOrgScope } from "@/lib/scope-guard";
import { logAudit } from "@/lib/audit";
import { sendPasswordSetupEmail } from "@/lib/email";

// GET /api/leagues — list leagues scoped by role
export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuth(req);
    if (isAuthError(auth)) return auth;

    const isSuperAdmin = auth.roles.some((r) => r.roleName === "super_admin");
    const orgAdminRole = auth.roles.find((r) => r.roleName === "organization_admin");
    const leagueAdminRole = auth.roles.find((r) => r.roleName === "league_admin");

    let where: Record<string, unknown> = {};

    if (isSuperAdmin) {
      // no filter — return all
    } else if (orgAdminRole?.organizationId) {
      where = { organizationId: orgAdminRole.organizationId };
    } else if (leagueAdminRole?.leagueId) {
      where = { id: leagueAdminRole.leagueId };
    } else {
      // club_admin, MEA, and other roles have no league scope — return empty
      return success([]);
    }

    const leagues = await prisma.league.findMany({
      where,
      include: {
        organization: { select: { id: true, name: true } },
        leagueType: { select: { id: true, name: true } },
        _count: { select: { seasons: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return success(leagues);
  } catch (error) {
    return serverError(error);
  }
}

// POST /api/leagues — create a league (org_admin only)
// Optionally creates a League Admin user in the same request
export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuth(req, ["organization_admin"]);
    if (isAuthError(auth)) return auth;

    const body = await req.json();
    const {
      organizationId, name, leagueTypeId, genderCategory, ageCategory,
      divisionLevel, logoUrl, description,
      adminFullName, adminEmail, adminPhone,
    } = body;

    if (!organizationId) return badRequest("organizationId is required");
    if (!name) return badRequest("name is required");
    if (!adminFullName) return badRequest("adminFullName is required");
    if (!adminEmail) return badRequest("adminEmail is required");

    if (!assertOrgScope(auth, organizationId)) {
      return badRequest("You do not have permission to create leagues for this organization");
    }

    // Check for duplicate league admin email if provided
    if (adminEmail) {
      const existing = await prisma.user.findUnique({ where: { email: adminEmail } });
      if (existing) return badRequest("A user with this email already exists");
    }

    const token = crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");

    // Run in a transaction so league + admin are created atomically
    const result = await prisma.$transaction(async (tx) => {
      const league = await tx.league.create({
        data: {
          organizationId,
          name,
          leagueTypeId: leagueTypeId || null,
          genderCategory: genderCategory || null,
          ageCategory: ageCategory || null,
          divisionLevel: divisionLevel || null,
          logoUrl: logoUrl || null,
          description: description || null,
        },
        include: {
          organization: { select: { id: true, name: true } },
          leagueType: { select: { id: true, name: true } },
        },
      });

      let adminUser: { id: string } | null = null;
      if (token) {
        adminUser = await tx.user.create({
          data: {
            fullName: adminFullName,
            email: adminEmail,
            phone: adminPhone || null,
            status: "inactive",
            passwordHash: "",
            passwordResetToken: token,
            passwordResetExpires: new Date(Date.now() + 3_600_000),
          },
        });

        const leagueAdminRole = await tx.role.findUnique({ where: { name: "league_admin" } });
        if (!leagueAdminRole) throw new Error("league_admin role not found");

        await tx.userRoleScope.create({
          data: {
            userId: adminUser!.id,
            roleId: leagueAdminRole.id,
            organizationId,
            leagueId: league.id,
          },
        });
      }

      return { league, adminUser };
    });

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const adminSetupLink = `${appUrl}/set-password?token=${token}`;
    try {
      await sendPasswordSetupEmail(adminEmail, token);
    } catch {
      // dev mode — link returned in response
    }

    await logAudit({
      userId: auth.userId,
      actionType: "league_created",
      targetId: result.league.id,
      targetType: "league",
      description: `League "${result.league.name}" created${result.adminUser ? ` with League Admin "${adminFullName}"` : ""}`,
    });

    return created({
      ...result.league,
      adminSetupLink,
    });
  } catch (error) {
    return serverError(error);
  }
}
