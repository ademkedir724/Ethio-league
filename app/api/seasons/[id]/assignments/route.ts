import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth, isAuthError, hasRole, hasOrgRole } from "@/lib/auth";
import { success, created, badRequest, notFound, serverError, parseUUID } from "@/lib/api-helpers";

// GET /api/seasons/[id]/assignments — get assigned referees and match event admins
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth(req);
    if (isAuthError(auth)) return auth;

    const { id } = await params;
    const seasonId = parseUUID(id);
    if (!seasonId) {
      return badRequest("Invalid season ID");
    }

    const season = await prisma.season.findUnique({
      where: { id: seasonId },
      select: { id: true, organizationId: true },
    });

    if (!season) {
      return notFound("Season not found");
    }

    // Get assigned referees
    const refereeAssignments = await prisma.refereeLeague.findMany({
      where: { seasonId },
      include: {
        referee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            licenseLevel: true,
            status: true,
          },
        },
      },
    });

    // Get match event admins assigned to this season
    const matchEventAdminRole = await prisma.role.findUnique({
      where: { name: "match_event_admin" },
    });

    const matchEventAdmins = matchEventAdminRole
      ? await prisma.userRoleScope.findMany({
          where: {
            roleId: matchEventAdminRole.id,
            seasonId,
          },
          include: {
            user: {
              select: {
                id: true,
                fullName: true,
                email: true,
                status: true,
              },
            },
          },
        })
      : [];

    return success({
      referees: refereeAssignments.map((ra) => ({
        ...ra.referee,
        roleLevel: ra.roleLevel,
        status: ra.status,
      })),
      matchEventAdmins: matchEventAdmins.map((mea) => mea.user),
    });
  } catch (error) {
    return serverError(error);
  }
}

// POST /api/seasons/[id]/assignments — assign referees and match event admins
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth(req);
    if (isAuthError(auth)) return auth;

    const { id } = await params;
    const seasonId = parseUUID(id);
    if (!seasonId) {
      return badRequest("Invalid season ID");
    }

    const season = await prisma.season.findUnique({
      where: { id: seasonId },
      select: { id: true, organizationId: true },
    });

    if (!season) {
      return notFound("Season not found");
    }

    // Auth check
    const isSuperAdmin = hasRole(auth, ["super_admin"]);
    const isOrgAdmin = hasOrgRole(auth, "organization_admin", season.organizationId);
    if (!isSuperAdmin && !isOrgAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const { refereeIds, matchEventAdminIds } = body;

    const results = {
      refereesAssigned: 0,
      matchEventAdminsAssigned: 0,
    };

    // Assign referees
    if (refereeIds && Array.isArray(refereeIds)) {
      // First, remove existing assignments
      await prisma.refereeLeague.deleteMany({
        where: { seasonId },
      });

      // Then create new assignments
      for (const refereeId of refereeIds) {
        await prisma.refereeLeague.create({
          data: {
            refereeId,
            seasonId,
            roleLevel: "main_referee",
            status: "active",
          },
        });
        results.refereesAssigned++;
      }
    }

    // Assign match event admins
    if (matchEventAdminIds && Array.isArray(matchEventAdminIds)) {
      const matchEventAdminRole = await prisma.role.findUnique({
        where: { name: "match_event_admin" },
      });

      if (matchEventAdminRole) {
        // Remove existing season-specific assignments (keep org-level ones)
        await prisma.userRoleScope.deleteMany({
          where: {
            roleId: matchEventAdminRole.id,
            seasonId,
          },
        });

        // Create new assignments
        for (const userId of matchEventAdminIds) {
          // Check if user already has this role at org level
          const existingScope = await prisma.userRoleScope.findFirst({
            where: {
              userId,
              roleId: matchEventAdminRole.id,
              organizationId: season.organizationId,
              seasonId: null,
            },
          });

          // Only create season-specific scope if they don't have org-level access
          if (!existingScope) {
            await prisma.userRoleScope.create({
              data: {
                userId,
                roleId: matchEventAdminRole.id,
                organizationId: season.organizationId,
                seasonId,
              },
            });
          }
          results.matchEventAdminsAssigned++;
        }
      }
    }

    return created(results);
  } catch (error) {
    return serverError(error);
  }
}
