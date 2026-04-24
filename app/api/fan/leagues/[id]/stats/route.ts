import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { success, badRequest, notFound, serverError, parseUUID } from "@/lib/api-helpers";
import { computeStandings, MatchResult } from "@/lib/standings";

// GET /api/fan/leagues/[id]/stats
// Public — no auth required
// Returns all-time aggregated stats for a league
export async function GET(
    _req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const leagueId = parseUUID(id);
        if (!leagueId) return badRequest("Invalid league ID");

        const league = await prisma.league.findUnique({ where: { id: leagueId }, select: { id: true } });
        if (!league) return notFound("League not found");

        // Fetch all seasons for this league
        const seasons = await prisma.season.findMany({
            where: { leagueId },
            select: { id: true, pointsWin: true, pointsDraw: true },
        });

        if (seasons.length === 0) {
            return success({
                totalSeasons: 0,
                totalMatches: 0,
                totalGoals: 0,
                totalClubs: 0,
                avgGoalsPerMatch: 0,
                topScorer: null,
                mostTitlesClub: null,
            });
        }

        const seasonIds = seasons.map((s) => s.id);

        // Fetch all completed matches
        const matches = await prisma.match.findMany({
            where: { seasonId: { in: seasonIds }, status: "completed" },
            select: {
                id: true,
                seasonId: true,
                homeClubId: true,
                awayClubId: true,
                homeScore: true,
                awayScore: true,
                homeClub: { select: { id: true, name: true, logoUrl: true } },
                awayClub: { select: { id: true, name: true, logoUrl: true } },
            },
        });

        const totalMatches = matches.length;
        const totalGoals = matches.reduce((sum, m) => sum + m.homeScore + m.awayScore, 0);
        const avgGoalsPerMatch = totalMatches > 0 ? Math.round((totalGoals / totalMatches) * 100) / 100 : 0;

        // Distinct clubs across all seasons
        const seasonClubs = await prisma.seasonClub.findMany({
            where: { seasonId: { in: seasonIds } },
            select: { clubId: true },
        });
        const totalClubs = new Set(seasonClubs.map((sc) => sc.clubId)).size;

        // All-time top scorer: aggregate goal events
        const goalEventTypes = await prisma.eventType.findMany({
            where: { name: { in: ["goal", "penalty_goal"] } },
            select: { id: true },
        });
        const goalTypeIds = goalEventTypes.map((et) => et.id);

        const goalEvents = await prisma.matchEvent.findMany({
            where: {
                eventTypeId: { in: goalTypeIds },
                match: { seasonId: { in: seasonIds } },
            },
            select: {
                playerId: true,
                clubId: true,
                player: { select: { firstName: true, lastName: true } },
                club: { select: { name: true } },
            },
        });

        const scorerMap = new Map<string, { playerId: string; playerName: string; clubName: string | null; goals: number }>();
        for (const ev of goalEvents) {
            const existing = scorerMap.get(ev.playerId);
            if (existing) {
                existing.goals += 1;
            } else {
                scorerMap.set(ev.playerId, {
                    playerId: ev.playerId,
                    playerName: `${ev.player.firstName} ${ev.player.lastName}`,
                    clubName: ev.club?.name ?? null,
                    goals: 1,
                });
            }
        }
        const topScorer = scorerMap.size > 0
            ? Array.from(scorerMap.values()).sort((a, b) => b.goals - a.goals)[0]
            : null;

        // Most titles: for each season compute standings, find rank-1 club
        const titlesMap = new Map<string, { clubId: string; clubName: string; titles: number }>();
        for (const season of seasons) {
            const seasonMatches = matches.filter((m) => m.seasonId === season.id);
            if (seasonMatches.length === 0) continue;

            const matchResults: MatchResult[] = seasonMatches.map((m) => ({
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
            if (standings.length > 0) {
                const champion = standings[0];
                const existing = titlesMap.get(champion.clubId);
                if (existing) {
                    existing.titles += 1;
                } else {
                    titlesMap.set(champion.clubId, { clubId: champion.clubId, clubName: champion.clubName, titles: 1 });
                }
            }
        }
        const mostTitlesClub = titlesMap.size > 0
            ? Array.from(titlesMap.values()).sort((a, b) => b.titles - a.titles)[0]
            : null;

        return success({
            totalSeasons: seasons.length,
            totalMatches,
            totalGoals,
            totalClubs,
            avgGoalsPerMatch,
            topScorer,
            mostTitlesClub,
        });
    } catch (error) {
        return serverError(error);
    }
}

export { handleOptions as OPTIONS } from "@/lib/fan-cors";
