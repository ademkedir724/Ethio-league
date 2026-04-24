import { NextRequest } from "next/server";
import crypto from "node:crypto";
import prisma from "@/lib/prisma";
import { requireAuth, isAuthError } from "@/lib/auth";
import { success, created, badRequest, forbidden, serverError } from "@/lib/api-helpers";
import { assertLeagueScope } from "@/lib/scope-guard";
import { sendPasswordSetupEmail } from "@/lib/email";
import { logAudit } from "@/lib/audit";

// GET /api/clubs — list clubs (scope-filtered by role)
export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuth(req);
    if (isAuthError(auth)) return auth;

    const where: Record<string, unknown> = {};

    const isOrgAdmin = auth.roles.some((r) => r.roleName === "organization_admin");
    const isLeagueAdmin = auth.roles.some((r) => r.roleName === "league_admin");
    const isSuperAdmin = auth.roles.some((r) => r.roleName === "super_admin");

    if (isSuperAdmin) {
      // no filter
    } else if (isOrgAdmin) {
      const orgId = auth.roles.find((r) => r.roleName === "organization_admin")?.organizationId;
      if (orgId) {
        where.league = { organizationId: orgId };
      }
    } else if (isLeagueAdmin) {
      const leagueId = auth.roles.find((r) => r.roleName === "league_admin")?.leagueId;
      if (leagueId) {
        where.leagueId = leagueId;
      }
    }

    const clubs = await prisma.club.findMany({
      where,
      include: {
        primaryStadium: { select: { id: true, name: true } },
        _count: { select: { seasonClubs: true } },
      },
      orderBy: { name: "asc" },
    });
    return success(clubs);
  } catch (error) {
    return serverError(error);
  }
}

// POST /api/clubs — create a club
// Roles: super_admin, organization_admin (simple creation)
//        league_admin (full club + admin user creation workflow)
export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuth(req, ["super_admin", "organization_admin", "league_admin"]);
    if (isAuthError(auth)) return auth;

    const isLeagueAdmin = auth.roles.some((r) => r.roleName === "league_admin");

    if (isLeagueAdmin) {
      // ── League admin workflow ──────────────────────────────────────────────
      // Creates a standalone club + club admin. Season assignment happens separately.
      const body = await req.json();
      const { name, adminFullName, adminEmail, adminPhone } = body;

      if (!name) return badRequest("Club name is required");
      if (!adminFullName) return badRequest("Admin full name is required");
      if (!adminEmail) return badRequest("Admin email is required");

      // Verify caller is a league admin
      const leagueAdminRole = auth.roles.find((r) => r.roleName === "league_admin");
      if (!leagueAdminRole?.leagueId) return forbidden();

      // Check email uniqueness
      const existingUser = await prisma.user.findUnique({ where: { email: adminEmail } });
      if (existingUser) {
        return badRequest("A user with this email already exists");
      }

      const token = crypto.randomBytes(32).toString("hex");

      const result = await prisma.$transaction(async (tx) => {
        const club = await tx.club.create({
          data: { name, status: "pending", leagueId: leagueAdminRole.leagueId },
        });

        const user = await tx.user.create({
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

        const clubAdminRole = await tx.role.findUnique({ where: { name: "club_admin" } });
        if (!clubAdminRole) throw new Error("club_admin role not found");

        await tx.userRoleScope.create({
          data: {
            userId: user.id,
            roleId: clubAdminRole.id,
            clubId: club.id,
          },
        });

        // No SeasonClub created here — league admin assigns clubs to seasons separately

        return { club, user };
      });

      const newClub = result.club;
      const newUser = result.user;

      // Send password setup email
      try {
        await sendPasswordSetupEmail(adminEmail, token);
      } catch (emailErr) {
        await logAudit({
          userId: auth.userId,
          actionType: "email_failure",
          targetId: newUser.id,
          targetType: "user",
          description: `Failed to send password setup email to ${adminEmail}: ${String(emailErr)}`,
        });
        return serverError(emailErr);
      }

      // Audit log
      await logAudit({
        userId: auth.userId,
        actionType: "club_created",
        targetId: newClub.id,
        targetType: "club",
        description: "Club created by league admin",
      });

      // Notify org admin via league → organization
      try {
        const league = await prisma.league.findUnique({
          where: { id: leagueAdminRole.leagueId },
          select: { organizationId: true },
        });

        if (league) {
          const orgAdminScope = await prisma.userRoleScope.findFirst({
            where: {
              organizationId: league.organizationId,
              role: { name: "organization_admin" },
            },
            select: { userId: true },
          });

          if (orgAdminScope) {
            await prisma.notification.create({
              data: {
                userId: orgAdminScope.userId,
                title: "New Club Created",
                body: `League admin created a new club "${newClub.name}" pending approval.`,
              },
            });
          }
        }
      } catch {
        // Notification failure must not break the response
      }

      return created({ club: newClub, adminSetupLink: `/set-password?token=${token}`, user: { id: newUser.id, email: newUser.email } });
    }

    // ── Super admin / organization admin workflow (unchanged) ─────────────
    const body = await req.json();
    const {
      name, shortName, country, city, foundedYear,
      logoUrl, primaryStadiumId, website, description,
    } = body;

    if (!name) return badRequest("Club name is required");

    const club = await prisma.club.create({
      data: {
        name,
        shortName: shortName || null,
        country: country || null,
        city: city || null,
        foundedYear: foundedYear || null,
        logoUrl: logoUrl || null,
        primaryStadiumId: primaryStadiumId || null,
        website: website || null,
        description: description || null,
      },
    });

    return created(club);
  } catch (error) {
    return serverError(error);
  }
}
