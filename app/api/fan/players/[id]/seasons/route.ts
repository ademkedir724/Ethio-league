import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { success, badRequest, notFound, serverError, parseUUID } from "@/lib/api-helpers";

// GET /api/fan/players/[id]/seasons
// Public — no auth required
// Returns career history per season
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

        // All season participations
        const seasonClubPlayers = await prisma.seasonClubPlayer.findMany({
            where: { playerId, requestStatus: "approved" },
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

        // Fetch event type IDs once
        const eventTypes = await prisma.eventType.findMany({
            where: { name: { in: ["goal", "penalty_goal", "assist", "yellow_card", "second_yellow", "red_card"] } },
            select: { id: true, name: true },
        });
        const goalIds = eventTypes.filter((et) => ["goal", "penalty_goal"].includes(et.name)).map((et) => et.id);
        const assistIds = eventTypes.filter((et) => et.name === "assist").map((et) => et.id);
        const yellowIds = eventTypes.filter((et) => ["yellow_card", "second_yellow"].includes(et.name)).map((et) => et.id);
        const redIds = eventTypes.filter((et) => et.name === "red_card").map((et) => et.id);

        const history = await Promise.all(
            seasonClubPlayers.map(async (scp) => {
                const season = scp.seasonClub.season;
                const seasonId = season.id;

                // Appearances: MatchLineup entries for this player in this season
                const appearances = await prisma.matchLineup.count({
                    where: {
                        seasonClubPlayerId: scp.id,
                        match: { seasonId },
                    },
                });

                // Goals
                const goals = await prisma.matchEvent.count({
                    where: {
                        playerId,
                        eventTypeId: { in: goalIds },
                        match: { seasonId },
                    },
                });

                // Assists
                const assists = await prisma.matchEvent.count({
                    where: {
                        playerId,
                        eventTypeId: { in: assistIds },
                        match: { seasonId },
                    },
                });

                // Yellow cards
                const yellowCards = await prisma.matchEvent.count({
                    where: {
                        playerId,
                        eventTypeId: { in: yellowIds },
                        match: { seasonId },
                    },
                });

                // Red cards
                const redCards = await prisma.matchEvent.count({
                    where: {
                        playerId,
                        eventTypeId: { in: redIds },
                        match: { seasonId },
                    },
                });

                // Rating snapshot closest to season end date
                const ratingSnapshot = await prisma.ratingSnapshot.findFirst({
                    where: {
                        entityType: "player",
                        entityId: playerId,
                        snapshotAt: { lte: season.endDate },
                    },
                    orderBy: { snapshotAt: "desc" },
                });

                return {
                    seasonId,
                    seasonName: season.name,
                    seasonStatus: season.status,
                    startDate: season.startDate,
                    endDate: season.endDate,
                    leagueId: season.league.id,
                    leagueName: season.league.name,
                    clubId: scp.seasonClub.clubId,
                    clubName: scp.seasonClub.club.name,
                    clubLogo: scp.seasonClub.club.logoUrl,
                    jerseyNumber: scp.jerseyNumber,
                    appearances,
                    goals,
                    assists,
                    yellowCards,
                    redCards,
                    ratingScore: ratingSnapshot?.score ?? null,
                };
            })
        );

        return success(history);
    } catch (error) {
        return serverError(error);
    }
}

export { handleOptions as OPTIONS } from "@/lib/fan-cors";
