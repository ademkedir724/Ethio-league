import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { success, badRequest, notFound, serverError, parseUUID } from "@/lib/api-helpers";
import { computeStandings, MatchResult } from "@/lib/standings";

// GET /api/fan/clubs/[id]/stats
// Public — no auth required
// Returns all-time aggregated stats for a club
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

        // All season participations
        const seasonClubs = await prisma.seasonClub.findMany({
            where: { clubId },
            include: {
                season: {
                    select: { id: true, name: true, pointsWin: true, pointsDraw: true },
                },
            },
        });

        const totalSeasons = seasonClubs.length;

        if (totalSeasons === 0) {
            const rating = await prisma.entityRating.findUnique({
                where: { entityType_entityId: { entityType: "club", entityId: clubId } },
            });
            const ratingHistory = await prisma.ratingSnapshot.findMany({
                where: { entityType: "club", entityId: clubId },
                orderBy: { snapshotAt: "desc" },
            });
            return success({
                totalSeasons: 0,
                totalMatches: 0,
                totalWins: 0,
                totalDraws: 0,
                totalLosses: 0,
                totalGoalsScored: 0,
                totalGoalsConceded: 0,
                winRate: 0,
                bestSeason: null,
                trophies: 0,
                rating: rating ?? null,
                ratingHistory,
            });
        }

        const seasonIds = seasonClubs.map((sc) => sc.seasonId);

        // All matches
        const allMatches = await prisma.match.findMany({
            where: {
                seasonId: { in: seasonIds },
                status: "completed",
                OR: [{ homeClubId: clubId }, { awayClubId: clubId }],
            },
            include: {
                homeClub: { select: { id: true, name: true, logoUrl: true } },
                awayClub: { select: { id: true, name: true, logoUrl: true } },
            },
        });

        let totalWins = 0, totalDraws = 0, totalLosses = 0;
        let totalGoalsScored = 0, totalGoalsConceded = 0;

        for (const m of allMatches) {
            const isHome = m.homeClubId === clubId;
            const gf = isHome ? m.homeScore : m.awayScore;
            const ga = isHome ? m.awayScore : m.homeScore;
            totalGoalsScored += gf;
            totalGoalsConceded += ga;
            if (gf > ga) totalWins++;
            else if (gf === ga) totalDraws++;
            else totalLosses++;
        }

        const totalMatches = allMatches.length;
        const winRate = totalMatches > 0 ? Math.round((totalWins / totalMatches) * 10000) / 100 : 0;

        // Best season (most points)
        let bestSeason: { seasonId: string; seasonName: string; points: number } | null = null;
        let trophies = 0;

        for (const sc of seasonClubs) {
            const seasonMatches = allMatches.filter(
                (m) => m.seasonId === sc.seasonId
            );

            let won = 0, drawn = 0, lost = 0, gf = 0, ga = 0;
            for (const m of seasonMatches) {
                const isHome = m.homeClubId === clubId;
                const mGf = isHome ? m.homeScore : m.awayScore;
                const mGa = isHome ? m.awayScore : m.homeScore;
                gf += mGf;
                ga += mGa;
                if (mGf > mGa) won++;
                else if (mGf === mGa) drawn++;
                else lost++;
            }

            const points = won * sc.season.pointsWin + drawn * sc.season.pointsDraw;

            if (!bestSeason || points > bestSeason.points) {
                bestSeason = { seasonId: sc.seasonId, seasonName: sc.season.name, points };
            }

            // Check if club won the title (position 1 in standings)
            const allSeasonMatches = await prisma.match.findMany({
                where: { seasonId: sc.seasonId, status: "completed" },
                include: {
                    homeClub: { select: { id: true, name: true, logoUrl: true } },
                    awayClub: { select: { id: true, name: true, logoUrl: true } },
                },
            });

            const matchResults: MatchResult[] = allSeasonMatches.map((m) => ({
                homeClubId: m.homeClubId,
                awayClubId: m.awayClubId,
                homeScore: m.homeScore,
                awayScore: m.awayScore,
                homeClubName: m.homeClub.name,
                awayClubName: m.awayClub.name,
                homeClubLogoUrl: m.homeClub.logoUrl,
                awayClubLogoUrl: m.awayClub.logoUrl,
            }));

            const standings = computeStandings(matchResults, sc.season.pointsWin, sc.season.pointsDraw);
            if (standings.length > 0 && standings[0].clubId === clubId) {
                trophies++;
            }
        }

        // Rating
        const rating = await prisma.entityRating.findUnique({
            where: { entityType_entityId: { entityType: "club", entityId: clubId } },
        });
        const ratingHistory = await prisma.ratingSnapshot.findMany({
            where: { entityType: "club", entityId: clubId },
            orderBy: { snapshotAt: "desc" },
        });

        return success({
            totalSeasons,
            totalMatches,
            totalWins,
            totalDraws,
            totalLosses,
            totalGoalsScored,
            totalGoalsConceded,
            winRate,
            bestSeason,
            trophies,
            rating: rating ?? null,
            ratingHistory,
        });
    } catch (error) {
        return serverError(error);
    }
}

export { handleOptions as OPTIONS } from "@/lib/fan-cors";
