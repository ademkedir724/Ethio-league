import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { hashPassword, requireAuth, isAuthError, hasOrgRole } from "@/lib/auth";
import {
  success,
  created,
  badRequest,
  forbidden,
  serverError,
  parsePagination,
  paginated,
} from "@/lib/api-helpers";
import { sendPasswordSetupEmail, getAppUrl } from "@/lib/email";
import { logAudit } from "@/lib/audit";
import { NextResponse } from "next/server";

// GET /api/users — list users scoped by role
// ?page=1&limit=20&search=<name|email>
export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuth(req, ["super_admin", "organization_admin", "league_admin"]);
    if (isAuthError(auth)) return auth;

    const isSuperAdmin = auth.roles.some((r) => r.roleName === "super_admin");
    const orgAdminRole = auth.roles.find((r) => r.roleName === "organization_admin");
    const leagueAdminRole = auth.roles.find((r) => r.roleName === "league_admin");

    let where: Record<string, unknown> = {};

    if (isSuperAdmin) {
      // no filter — sees all
    } else if (orgAdminRole?.organizationId) {
      const orgId = orgAdminRole.organizationId;
      const orgClubs = await prisma.club.findMany({
        where: { league: { organizationId: orgId } },
        select: { id: true },
      });
      const clubIds = orgClubs.map((c) => c.id);
      where = {
        userRoleScopes: {
          some: {
            OR: [
              { organizationId: orgId },
              ...(clubIds.length > 0 ? [{ clubId: { in: clubIds } }] : []),
            ],
          },
        },
      };
    } else if (leagueAdminRole?.leagueId) {
      const league = await prisma.league.findUnique({
        where: { id: leagueAdminRole.leagueId },
        select: { organizationId: true },
      });
      if (league) {
        const orgId = league.organizationId;
        const orgClubs = await prisma.club.findMany({
          where: { league: { organizationId: orgId } },
          select: { id: true },
        });
        const clubIds = orgClubs.map((c) => c.id);
        where = {
          userRoleScopes: {
            some: {
              AND: [
                { role: { name: { in: ["league_admin", "match_event_admin", "club_admin"] } } },
                {
                  OR: [
                    { organizationId: orgId },
                    ...(clubIds.length > 0 ? [{ clubId: { in: clubIds } }] : []),
                  ],
                },
              ],
            },
          },
        };
      }
    }

    const sp = req.nextUrl.searchParams;
    const { page, limit, skip } = parsePagination(sp);
    const search = sp.get("search")?.trim();
    if (search) {
      (where as Record<string, unknown>).OR = [
        { fullName: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
      ];
    }

    const select = {
      id: true,
      email: true,
      fullName: true,
      phone: true,
      photoUrl: true,
      status: true,
      createdAt: true,
      userRoleScopes: { include: { role: true } },
    };

    const [total, users] = await Promise.all([
      prisma.user.count({ where }),
      prisma.user.findMany({ where, select, orderBy: { createdAt: "desc" }, skip, take: limit }),
    ]);

    return paginated(users, total, page, limit);

  } catch (error) {
    return serverError(error);
  }
}

// POST /api/users
// - Public registration (no auth, no role): creates a fan user with password
// - Org admin creating a Match Event Admin: requires auth + role + organizationId
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, fullName, phone, role, organizationId, password } = body;

    if (!email || !fullName) {
      return badRequest("email and fullName are required");
    }

    // ── Privileged creation: org_admin creating a match_event_admin ──────────
    if (role === "MATCH_EVENT_ADMIN" || role === "match_event_admin") {
      const auth = await requireAuth(req, ["super_admin", "organization_admin"]);
      if (isAuthError(auth)) return auth;

      const isSuperAdmin = auth.roles.some((r) => r.roleName === "super_admin");
      if (!isSuperAdmin) {
        if (!organizationId || !hasOrgRole(auth, "organization_admin", organizationId)) {
          return forbidden();
        }
      }

      const existing = await prisma.user.findUnique({ where: { email } });
      if (existing) return badRequest("A user with this email already exists");

      const token = crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");
      const appUrl = getAppUrl(req);

      const result = await prisma.$transaction(async (tx) => {
        const user = await tx.user.create({
          data: {
            fullName,
            email,
            phone: phone || null,
            status: "inactive",
            passwordHash: "",
            passwordResetToken: token,
            passwordResetExpires: new Date(Date.now() + 3_600_000),
          },
        });

        const meaRole = await tx.role.findUnique({ where: { name: "match_event_admin" } });
        if (!meaRole) throw new Error("match_event_admin role not found");

        await tx.userRoleScope.create({
          data: {
            userId: user.id,
            roleId: meaRole.id,
            organizationId: organizationId || null,
          },
        });

        return user;
      });

      // Send setup email (non-blocking failure returns link in response)
      const passwordSetupLink = `${appUrl}/set-password?token=${token}`;
      try {
        await sendPasswordSetupEmail(email, token, req);
      } catch {
        // email not configured — return link in response for dev
      }

      await logAudit({
        userId: auth.userId,
        actionType: "user_created",
        targetId: result.id,
        targetType: "user",
        description: `Match Event Admin "${fullName}" (${email}) created`,
      });

      return created({
        id: result.id,
        email: result.email,
        fullName: result.fullName,
        status: result.status,
        passwordSetupLink,
      });
    }

    // ── Public registration ───────────────────────────────────────────────────
    if (!password) {
      return badRequest("password is required for public registration");
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return badRequest("Email already in use");

    const passwordHash = await hashPassword(password);

    const user = await prisma.user.create({
      data: { email, passwordHash, fullName, phone },
      select: { id: true, email: true, fullName: true, phone: true, status: true, createdAt: true },
    });

    const fanRole = await prisma.role.findUnique({ where: { name: "fan" } });
    if (fanRole) {
      await prisma.userRoleScope.create({ data: { userId: user.id, roleId: fanRole.id } });
    }

    return created(user);
  } catch (error) {
    return serverError(error);
  }
}
