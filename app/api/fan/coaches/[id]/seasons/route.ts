import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { success, badRequest, notFound, serverError, parseUUID } from "@/lib/api-helpers";

// GET /api/fan/coaches/[id]/seasons
// Public — no auth required
// Returns career history for a coach ordered by season start date desc
export async function GET(
    _req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const coachId = parseUUID(id);
        if (!coachId) return badRequest("Invalid coach ID");

        const coach = await prisma.coach.findUnique({ where: { id: coachId }, select: { id: true } });
        if (!coach) return notFound("Coach not found");

        const seasonClubCoaches = await prisma.seasonClubCoach.findMany({
            where: { coachId },
            include: {
                seasonClub: {
                    include: {
                        club: { select: { id: true, name: true, logoUrl: true } },
                        season: {
                            include: {
                                league: { select: { id: true, name: true } },
                            },
                        },
                    },
                },
            },
            orderBy: { seasonClub: { season: { startDate: "desc" } } },
        });

        const history = seasonClubCoaches.map((scc) => ({
            seasonId: scc.seasonClub.seasonId,
            seasonName: scc.seasonClub.season.name,
            seasonStatus: scc.seasonClub.season.status,
            startDate: scc.seasonClub.season.startDate,
            endDate: scc.seasonClub.season.endDate,
            leagueId: scc.seasonClub.season.league.id,
            leagueName: scc.seasonClub.season.league.name,
            clubId: scc.seasonClub.clubId,
            clubName: scc.seasonClub.club.name,
            clubLogo: scc.seasonClub.club.logoUrl,
            role: scc.role,
            startDate_assignment: scc.startDate,
            endDate_assignment: scc.endDate,
        }));

        return success(history);
    } catch (error) {
        return serverError(error);
    }
}

export { handleOptions as OPTIONS } from "@/lib/fan-cors";
