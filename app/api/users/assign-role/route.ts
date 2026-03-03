import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth, isAuthError, hasRole, hasOrgRole } from "@/lib/auth";
import {
  success,
  badRequest,
  notFound,
  serverError,
} from "@/lib/api-helpers";
import { NextResponse } from "next/server";

// POST /api/users/assign-role — assign a scoped role to a user
// Body: { userId, roleName, organizationId?, seasonId?, clubId? }
export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuth(req);
    if (isAuthError(auth)) return auth;

    const { userId, roleName, organizationId, seasonId, clubId } =
      await req.json();

    if (!userId || !roleName) {
      return badRequest("userId and roleName are required");
    }

    // Check target user exists
    const targetUser = await prisma.user.findUnique({ where: { id: userId } });
    if (!targetUser) return notFound("User not found");

    // Check role exists
    const role = await prisma.role.findUnique({ where: { name: roleName } });
    if (!role) return notFound("Role not found");

    // Authorization: who can assign what
    const isSuperAdmin = hasRole(auth, ["super_admin"]);

    if (roleName === "organization_admin") {
      // Only super_admin can assign organization_admin
      if (!isSuperAdmin) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      if (!organizationId) {
        return badRequest("organizationId is required for organization_admin");
      }
    } else if (roleName === "league_admin" || roleName === "match_event_admin") {
      // super_admin or the organization_admin of the org
      if (!isSuperAdmin) {
        if (!organizationId || !hasOrgRole(auth, "organization_admin", organizationId)) {
          return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }
      }
      if (!seasonId) {
        return badRequest("seasonId is required for league/match_event admin");
      }
    } else if (roleName === "club_admin") {
      if (!isSuperAdmin) {
        if (!organizationId || !hasOrgRole(auth, "organization_admin", organizationId)) {
          return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }
      }
      if (!clubId) {
        return badRequest("clubId is required for club_admin");
      }
    } else if (roleName === "super_admin") {
      if (!isSuperAdmin) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    const scope = await prisma.userRoleScope.create({
      data: {
        userId,
        roleId: role.id,
        organizationId: organizationId || null,
        seasonId: seasonId || null,
        clubId: clubId || null,
      },
      include: { role: true },
    });

    return success(scope);
  } catch (error) {
    return serverError(error);
  }
}

// DELETE /api/users/assign-role — remove a role scope
// Body: { scopeId }
export async function DELETE(req: NextRequest) {
  try {
    const auth = await requireAuth(req, ["super_admin", "organization_admin"]);
    if (isAuthError(auth)) return auth;

    const { scopeId } = await req.json();
    if (!scopeId) return badRequest("scopeId is required");

    await prisma.userRoleScope.delete({ where: { id: scopeId } });
    return success({ message: "Role scope removed" });
  } catch (error) {
    return serverError(error);
  }
}
