import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth, isAuthError, hasOrgRole } from "@/lib/auth";
import {
  success,
  badRequest,
  forbidden,
  notFound,
  serverError,
  parseUUID,
} from "@/lib/api-helpers";

// GET /api/users/:id
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: idStr } = await params;
    const id = parseUUID(idStr);
    if (!id) return badRequest("Invalid user ID");

    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        fullName: true,
        phone: true,
        status: true,
        createdAt: true,
        userRoleScopes: {
          include: { role: true },
        },
      },
    });

    if (!user) return notFound("User not found");
    return success(user);
  } catch (error) {
    return serverError(error);
  }
}

// PATCH /api/users/:id — update user info
// Edit hierarchy:
//   super_admin     → can edit organization_admin users only
//   organization_admin → can edit league_admin and match_event_admin users only
//   league_admin    → can edit club_admin users only
//   any user        → can edit their own profile (fullName, phone only)
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth(req);
    if (isAuthError(auth)) return auth;

    const { id: idStr } = await params;
    const id = parseUUID(idStr);
    if (!id) return badRequest("Invalid user ID");

    const isSelf = auth.userId === id;
    const callerRoles = auth.roles.map((r) => r.roleName);
    const isSuperAdmin = callerRoles.includes("super_admin");
    const isOrgAdmin = callerRoles.includes("organization_admin");
    const isLeagueAdmin = callerRoles.includes("league_admin");

    // Load target user with their roles
    const targetUser = await prisma.user.findUnique({
      where: { id },
      include: { userRoleScopes: { include: { role: true } } },
    });
    if (!targetUser) return notFound("User not found");

    const targetRoles = targetUser.userRoleScopes.map((s) => s.role.name);

    // Determine if caller is allowed to edit this target
    let canEdit = false;
    let allowedFields: string[] = ["fullName", "phone"];

    if (isSelf) {
      // Any user can edit their own name/phone
      canEdit = true;
    } else if (isSuperAdmin) {
      // super_admin can edit any user's status, and org_admin users' details
      canEdit = true;
      if (targetRoles.includes("organization_admin")) {
        allowedFields = ["fullName", "phone", "status"];
      } else {
        // For all other users, super_admin can only change status
        allowedFields = ["status"];
      }
    } else if (isOrgAdmin) {
      // org_admin can only edit league_admin and match_event_admin users in their org
      const orgId = auth.roles.find((r) => r.roleName === "organization_admin")?.organizationId;
      const targetInOrg = targetUser.userRoleScopes.some((s) => s.organizationId === orgId);
      const targetIsEditable =
        targetRoles.includes("league_admin") || targetRoles.includes("match_event_admin");
      if (orgId && targetInOrg && targetIsEditable) {
        canEdit = true;
        allowedFields = ["fullName", "phone", "status"];
      }
    } else if (isLeagueAdmin) {
      // league_admin can only edit club_admin users scoped to their league's clubs
      const leagueId = auth.roles.find((r) => r.roleName === "league_admin")?.leagueId;
      const targetIsClubAdmin = targetRoles.includes("club_admin");
      if (leagueId && targetIsClubAdmin) {
        // Verify the club_admin's club belongs to a season in this league
        const clubScope = targetUser.userRoleScopes.find((s) => s.role.name === "club_admin" && s.clubId);
        if (clubScope?.clubId) {
          const seasonClub = await prisma.seasonClub.findFirst({
            where: { clubId: clubScope.clubId, season: { leagueId } },
          });
          if (seasonClub) canEdit = true;
        }
      }
    }

    if (!canEdit) return forbidden();

    const data = await req.json();
    const updateData: Record<string, unknown> = {};
    for (const field of allowedFields) {
      if (data[field] !== undefined) updateData[field] = data[field];
    }

    if (Object.keys(updateData).length === 0) {
      return badRequest("No valid fields to update");
    }

    const updated = await prisma.user.update({
      where: { id },
      data: updateData,
      select: { id: true, email: true, fullName: true, phone: true, status: true },
    });

    return success(updated);
  } catch (error) {
    return serverError(error);
  }
}

// DELETE /api/users/:id — super_admin only
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth(req, ["super_admin"]);
    if (isAuthError(auth)) return auth;

    const { id: idStr } = await params;
    const id = parseUUID(idStr);
    if (!id) return badRequest("Invalid user ID");

    await prisma.user.delete({ where: { id } });
    return success({ message: "User deleted" });
  } catch (error) {
    return serverError(error);
  }
}
