import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { success, badRequest, notFound, serverError, parseUUID } from "@/lib/api-helpers";

// GET /api/fan/players/[id]/stats
// Public — no auth required
// Returns all-time aggregated stats for a player
export async function GET(
    _req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const playerId = parseUUID(id);
        if (!playerId) return badRequest("Invalid player ID");

        const player = await prisma.player.findUnique({ where: { id: playerId }, select: { id: true } });
        if (!player) return notFound("Player not found");

        // Fetch event type IDs
        const eventTypes = await prisma.eventType.findMany({
            where: { name: { in: ["goal", "penalty_goal", "assist", "yellow_card", "second_yellow", "red_card"] } },
            select: { id: true, name: true },
        });
        const goalIds = eventTypes.filter((et) => ["goal", "penalty_goal"].includes(et.name)).map((et) => et.id);
        const assistIds = eventTypes.filter((et) => et.name === "assist").map((et) => et.id);
        const yellowIds = eventTypes.filter((et) => ["yellow_card", "second_yellow"].includes(et.name)).map((et) => et.id);
        const redIds = eventTypes.filter((et) => et.name === "red_card").map((et) => et.id);

        // All season participations
        const seasonClubPlayers = await prisma.seasonClubPlayer.findMany({
            where: { playerId, requestStatus: "approved" },
            include: {
                seasonClub: {
                    include: {
                        club: { select: { id: true, name: true } },
                        season: {
                            include: { league: { select: { id: true, name: true } } },
                        },
                    },
                },
            },
        });

        // Total appearances
        const totalAppearances = await prisma.matchLineup.count({
            where: { seasonClubPlayer: { playerId } },
        });

        // Total goals
        const totalGoals = await prisma.matchEvent.count({
            where: { playerId, eventTypeId: { in: goalIds } },
        });

        // Total assists
        const totalAssists = await prisma.matchEvent.count({
            where: { playerId, eventTypeId: { in: assistIds } },
        });

        // Total yellow cards
        const totalYellowCards = await prisma.matchEvent.count({
            where: { playerId, eventTypeId: { in: yellowIds } },
        });

        // Total red cards
        const totalRedCards = await prisma.matchEvent.count({
            where: { playerId, eventTypeId: { in: redIds } },
        });

        const goalsPerMatch = totalAppearances > 0
            ? Math.round((totalGoals / totalAppearances) * 100) / 100
            : 0;

        // Best season (most goals)
        let bestSeason: { seasonId: string; seasonName: string; goals: number } | null = null;
        for (const scp of seasonClubPlayers) {
            const seasonGoals = await prisma.matchEvent.count({
                where: {
                    playerId,
                    eventTypeId: { in: goalIds },
                    match: { seasonId: scp.seasonClub.seasonId },
                },
            });
            if (!bestSeason || seasonGoals > bestSeason.goals) {
                bestSeason = {
                    seasonId: scp.seasonClub.seasonId,
                    seasonName: scp.seasonClub.season.name,
                    goals: seasonGoals,
                };
            }
        }

        // Distinct clubs and leagues
        const clubIds = new Set(seasonClubPlayers.map((scp) => scp.seasonClub.clubId));
        const leagueIds = new Set(seasonClubPlayers.map((scp) => scp.seasonClub.season.leagueId));

        const clubs = Array.from(clubIds).map((cid) => {
            const scp = seasonClubPlayers.find((s) => s.seasonClub.clubId === cid);
            return { clubId: cid, clubName: scp?.seasonClub.club.name ?? "" };
        });

        const leagues = Array.from(leagueIds).map((lid) => {
            const scp = seasonClubPlayers.find((s) => s.seasonClub.season.leagueId === lid);
            return { leagueId: lid, leagueName: scp?.seasonClub.season.league.name ?? "" };
        });

        // Rating
        const rating = await prisma.entityRating.findUnique({
            where: { entityType_entityId: { entityType: "player", entityId: playerId } },
        });
        const ratingHistory = await prisma.ratingSnapshot.findMany({
            where: { entityType: "player", entityId: playerId },
            orderBy: { snapshotAt: "desc" },
        });

        return success({
            totalAppearances,
            totalGoals,
            totalAssists,
            totalYellowCards,
            totalRedCards,
            goalsPerMatch,
            bestSeason,
            totalClubs: clubIds.size,
            clubs,
            totalLeagues: leagueIds.size,
            leagues,
            rating: rating ?? null,
            ratingHistory,
        });
    } catch (error) {
        return serverError(error);
    }
}

export { handleOptions as OPTIONS } from "@/lib/fan-cors";
