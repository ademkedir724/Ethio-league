import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth, isAuthError } from "@/lib/auth";
import { success, created, badRequest, notFound, forbidden, serverError, parseUUID, unprocessableEntity } from "@/lib/api-helpers";
import { assertOrgScope } from "@/lib/scope-guard";

// GET /api/seasons/[id]/assignments — get assigned referees and MEAs
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth(req);
    if (isAuthError(auth)) return auth;

    const { id } = await params;
    const seasonId = parseUUID(id);
    if (!seasonId) return badRequest("Invalid season ID");

    const season = await prisma.season.findUnique({
      where: { id: seasonId },
      include: { league: true },
    });
    if (!season) return notFound("Season not found");

    const refereeAssignments = await prisma.seasonReferee.findMany({
      where: { seasonId },
      include: {
        referee: { select: { id: true, firstName: true, lastName: true, licenseLevel: true, status: true } },
      },
    });

    const matchEventAdminRole = await prisma.role.findUnique({ where: { name: "match_event_admin" } });
    const matchEventAdmins = matchEventAdminRole
      ? await prisma.userRoleScope.findMany({
        where: { roleId: matchEventAdminRole.id, seasonId },
        include: { user: { select: { id: true, fullName: true, email: true, status: true } } },
      })
      : [];

    return success({
      referees: refereeAssignments.map((ra) => ({ ...ra.referee, roleLevel: ra.roleLevel, status: ra.status })),
      matchEventAdmins: matchEventAdmins.map((mea) => mea.user),
    });
  } catch (error) {
    return serverError(error);
  }
}

// POST /api/seasons/[id]/assignments — assign referees and MEAs to a season (Org Admin)
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth(req, ["super_admin", "organization_admin"]);
    if (isAuthError(auth)) return auth;

    const { id } = await params;
    const seasonId = parseUUID(id);
    if (!seasonId) return badRequest("Invalid season ID");

    const season = await prisma.season.findUnique({
      where: { id: seasonId },
      include: { league: true },
    });
    if (!season) return notFound("Season not found");

    if (!assertOrgScope(auth, season.league.organizationId)) return forbidden();

    // 1. Season must be active
    if (season.status !== "active") {
      return unprocessableEntity({
        error: "Assignments can only be made to active seasons",
        code: "SEASON_NOT_ACTIVE",
      });
    }

    const body = await req.json();
    const { refereeIds, matchEventAdminIds } = body;

    // 2. Quota enforcement based on matches per round
    // matchesPerRound = floor(n/2) where n = requiredClubs
    // Need matchesPerRound + 1 MEAs and (matchesPerRound + 1) * 4 referees
    // (one MEA and one set of 4 referees take a break each round)
    if (season.requiredClubs !== null) {
      const matchesPerRound = Math.floor(season.requiredClubs / 2);
      const maxMEAs = matchesPerRound + 1;
      const maxReferees = (matchesPerRound + 1) * 4;

      if (refereeIds && Array.isArray(refereeIds) && refereeIds.length > maxReferees) {
        return unprocessableEntity({
          error: `Referee quota exceeded. Max ${maxReferees} allowed (${matchesPerRound + 1} sets of 4), you selected ${refereeIds.length}`,
          code: "QUOTA_EXCEEDED_REFEREES",
          limit: maxReferees,
          requested: refereeIds.length,
        });
      }
      if (matchEventAdminIds && Array.isArray(matchEventAdminIds) && matchEventAdminIds.length > maxMEAs) {
        return unprocessableEntity({
          error: `MEA quota exceeded. Max ${maxMEAs} allowed (${matchesPerRound} active + 1 on break), you selected ${matchEventAdminIds.length}`,
          code: "QUOTA_EXCEEDED_MEAS",
          limit: maxMEAs,
          requested: matchEventAdminIds.length,
        });
      }
    }
    // 3. Verify all MEA IDs belong to this org
    if (matchEventAdminIds && Array.isArray(matchEventAdminIds) && matchEventAdminIds.length > 0) {
      const meaRoleCheck = await prisma.role.findUnique({ where: { name: "match_event_admin" } });
      if (meaRoleCheck) {
        const validMEAs = await prisma.userRoleScope.findMany({
          where: {
            userId: { in: matchEventAdminIds },
            roleId: meaRoleCheck.id,
            organizationId: season.league.organizationId,
          },
        });
        if (validMEAs.length !== matchEventAdminIds.length) {
          return unprocessableEntity({
            error: "One or more MEAs do not belong to this organization",
            code: "OUT_OF_SCOPE_MEA",
          });
        }
      }
    }

    const results = { refereesAssigned: 0, matchEventAdminsAssigned: 0 };

    if (refereeIds && Array.isArray(refereeIds)) {
      await prisma.seasonReferee.deleteMany({ where: { seasonId } });
      for (const refereeId of refereeIds) {
        await prisma.seasonReferee.create({
          data: { refereeId, seasonId, roleLevel: "main_referee", status: "active" },
        });
        results.refereesAssigned++;
      }
    }

    if (matchEventAdminIds && Array.isArray(matchEventAdminIds)) {
      const meaRole = await prisma.role.findUnique({ where: { name: "match_event_admin" } });
      if (meaRole) {
        await prisma.userRoleScope.deleteMany({ where: { roleId: meaRole.id, seasonId } });
        for (const userId of matchEventAdminIds) {
          await prisma.userRoleScope.create({
            data: { userId, roleId: meaRole.id, seasonId },
          });
          results.matchEventAdminsAssigned++;
        }
      }
    }

    return created(results);
  } catch (error) {
    return serverError(error);
  }
}
