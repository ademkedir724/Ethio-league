import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { success, badRequest, notFound, serverError, parseUUID } from "@/lib/api-helpers";
import { computeStandings, MatchResult } from "@/lib/standings";

// GET /api/fan/clubs/[id]/seasons
// Public — no auth required
// Returns season-by-season history for a club
export async function GET(
    _req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const clubId = parseUUID(id);
        if (!clubId) return badRequest("Invalid club ID");

        const club = await prisma.club.findUnique({ where: { id: clubId }, select: { id: true } });
        if (!club) return notFound("Club not found");

        const seasonClubs = await prisma.seasonClub.findMany({
            where: { clubId },
            include: {
                season: {
                    include: {
                        league: { select: { id: true, name: true } },
                    },
                },
            },
            orderBy: { season: { startDate: "desc" } },
        });

        // Fetch goal event type IDs once
        const goalEventTypes = await prisma.eventType.findMany({
            where: { name: { in: ["goal", "penalty_goal"] } },
            select: { id: true },
        });
        const goalTypeIds = goalEventTypes.map((et) => et.id);

        const history = await Promise.all(
            seasonClubs.map(async (sc) => {
                const season = sc.season;

                // All completed matches for this season
                const allMatches = await prisma.match.findMany({
                    where: { seasonId: season.id, status: "completed" },
                    include: {
                        homeClub: { select: { id: true, name: true, logoUrl: true } },
                        awayClub: { select: { id: true, name: true, logoUrl: true } },
                    },
                });

                // Club's own matches
                const clubMatches = allMatches.filter(
                    (m) => m.homeClubId === clubId || m.awayClubId === clubId
                );

                let won = 0, drawn = 0, lost = 0, goalsFor = 0, goalsAgainst = 0;
                for (const m of clubMatches) {
                    const isHome = m.homeClubId === clubId;
                    const gf = isHome ? m.homeScore : m.awayScore;
                    const ga = isHome ? m.awayScore : m.homeScore;
                    goalsFor += gf;
                    goalsAgainst += ga;
                    if (gf > ga) won++;
                    else if (gf === ga) drawn++;
                    else lost++;
                }

                const points = won * season.pointsWin + drawn * season.pointsDraw;

                // Compute standings to get position
                const matchResults: MatchResult[] = allMatches.map((m) => ({
                    homeClubId: m.homeClubId,
                    awayClubId: m.awayClubId,
                    homeScore: m.homeScore,
                    awayScore: m.awayScore,
                    homeClubName: m.homeClub.name,
                    awayClubName: m.awayClub.name,
                    homeClubLogoUrl: m.homeClub.logoUrl,
                    awayClubLogoUrl: m.awayClub.logoUrl,
                }));
                const standings = computeStandings(matchResults, season.pointsWin, season.pointsDraw);
                const position = standings.findIndex((s) => s.clubId === clubId) + 1 || null;

                // Top scorer for this club in this season
                const goalEvents = await prisma.matchEvent.findMany({
                    where: {
                        eventTypeId: { in: goalTypeIds },
                        clubId,
                        match: { seasonId: season.id },
                    },
                    select: {
                        playerId: true,
                        player: { select: { firstName: true, lastName: true } },
                    },
                });

                const scorerMap = new Map<string, { playerId: string; playerName: string; goals: number }>();
                for (const ev of goalEvents) {
                    const existing = scorerMap.get(ev.playerId);
                    if (existing) existing.goals++;
                    else scorerMap.set(ev.playerId, {
                        playerId: ev.playerId,
                        playerName: `${ev.player.firstName} ${ev.player.lastName}`,
                        goals: 1,
                    });
                }
                const topScorer = scorerMap.size > 0
                    ? Array.from(scorerMap.values()).sort((a, b) => b.goals - a.goals)[0]
                    : null;

                return {
                    seasonId: season.id,
                    seasonName: season.name,
                    seasonStatus: season.status,
                    startDate: season.startDate,
                    endDate: season.endDate,
                    leagueId: season.league.id,
                    leagueName: season.league.name,
                    position,
                    played: clubMatches.length,
                    won,
                    drawn,
                    lost,
                    goalsFor,
                    goalsAgainst,
                    goalDifference: goalsFor - goalsAgainst,
                    points,
                    topScorer,
                };
            })
        );

        return success(history);
    } catch (error) {
        return serverError(error);
    }
}

export { handleOptions as OPTIONS } from "@/lib/fan-cors";
