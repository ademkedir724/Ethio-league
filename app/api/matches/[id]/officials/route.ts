import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth, isAuthError } from "@/lib/auth";
import { success, badRequest, notFound, forbidden, serverError, parseUUID } from "@/lib/api-helpers";
import { assertLeagueScope } from "@/lib/scope-guard";

// PATCH /api/matches/[id]/officials
// League Admin edits referee roles/assignments and MEA for a match.
// Body: {
//   referees?: Array<{ refereeId: string; role: string }>,
//   meaUserId?: string | null
// }
export async function PATCH(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const auth = await requireAuth(req, ["league_admin", "super_admin"]);
        if (isAuthError(auth)) return auth;

        const { id: idStr } = await params;
        const matchId = parseUUID(idStr);
        if (!matchId) return badRequest("Invalid match ID");

        const match = await prisma.match.findUnique({
            where: { id: matchId },
            include: { season: { include: { league: true } } },
        });
        if (!match) return notFound("Match not found");

        if (!assertLeagueScope(auth, match.season.leagueId)) return forbidden();

        const body = await req.json();
        const { referees, meaUserId } = body;

        // Update referee assignments
        if (referees && Array.isArray(referees)) {
            // Validate roles
            const validRoles = ["main_referee", "side_referee_1", "side_referee_2", "fourth_referee"];
            for (const r of referees) {
                if (!validRoles.includes(r.role)) {
                    return badRequest(`Invalid role "${r.role}". Must be one of: ${validRoles.join(", ")}`);
                }
            }

            // Verify all referees are assigned to this season
            const seasonRefereeIds = (await prisma.seasonReferee.findMany({
                where: { seasonId: match.seasonId },
                select: { refereeId: true },
            })).map((sr) => sr.refereeId);

            const invalidRefs = referees.filter((r: { refereeId: string }) => !seasonRefereeIds.includes(r.refereeId));
            if (invalidRefs.length > 0) {
                return badRequest("One or more referees are not assigned to this season");
            }

            await prisma.matchReferee.deleteMany({ where: { matchId } });
            if (referees.length > 0) {
                await prisma.matchReferee.createMany({
                    data: referees.map((r: { refereeId: string; role: string }) => ({
                        matchId,
                        refereeId: r.refereeId,
                        role: r.role,
                    })),
                });
            }
        }

        // Update MEA assignment
        if (meaUserId !== undefined) {
            await prisma.$executeRaw`DELETE FROM match_meas WHERE "matchId" = ${matchId}::uuid`;
            if (meaUserId) {
                // Verify MEA is assigned to this season
                const meaRole = await prisma.role.findUnique({ where: { name: "match_event_admin" } });
                if (meaRole) {
                    const meaScope = await prisma.userRoleScope.findFirst({
                        where: { userId: meaUserId, roleId: meaRole.id, seasonId: match.seasonId },
                    });
                    if (!meaScope) return badRequest("MEA is not assigned to this season");
                }
                await prisma.$executeRaw`
          INSERT INTO match_meas (id, "matchId", "userId", "assignedAt")
          VALUES (gen_random_uuid(), ${matchId}::uuid, ${meaUserId}::uuid, NOW())
        `;
            }
        }

        return success({ message: "Match officials updated" });
    } catch (error) {
        return serverError(error);
    }
}
