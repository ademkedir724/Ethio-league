import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { success, serverError } from "@/lib/api-helpers";

// GET /api/fan/ratings/players
// Public — no auth required
// Query: ?leagueId, ?seasonId, ?limit, ?search
export async function GET(req: NextRequest) {
    try {
        const { searchParams } = req.nextUrl;
        const leagueId = searchParams.get("leagueId");
        const seasonId = searchParams.get("seasonId");
        const limitParam = searchParams.get("limit");
        const search = searchParams.get("search");
        const limit = limitParam ? Math.max(1, Math.min(200, Number(limitParam))) : 50;

        // If filtering by league or season, get matching playerIds first
        let playerIdFilter: string[] | undefined;

        if (seasonId || leagueId) {
            const seasonClubPlayers = await prisma.seasonClubPlayer.findMany({
                where: {
                    requestStatus: "approved",
                    ...(seasonId && { seasonClub: { seasonId } }),
                    ...(leagueId && { seasonClub: { season: { leagueId } } }),
                },
                select: { playerId: true },
                distinct: ["playerId"],
            });
            playerIdFilter = seasonClubPlayers.map((scp) => scp.playerId);
        }

        // Fetch ratings
        const ratings = await prisma.entityRating.findMany({
            where: {
                entityType: "player",
                ...(playerIdFilter && { entityId: { in: playerIdFilter } }),
            },
            orderBy: { score: "desc" },
            take: limit,
        });

        if (ratings.length === 0) return success([]);

        // Fetch player details
        const playerIds = ratings.map((r) => r.entityId);
        const players = await prisma.player.findMany({
            where: {
                id: { in: playerIds },
                status: "active",
                ...(search && {
                    OR: [
                        { firstName: { contains: search, mode: "insensitive" } },
                        { lastName: { contains: search, mode: "insensitive" } },
                    ],
                }),
            },
            include: {
                primaryPosition: { select: { id: true, name: true, code: true } },
                originClub: { select: { id: true, name: true, logoUrl: true } },
            },
        });

        const playerMap = new Map<string, typeof players[number]>(players.map((p) => [p.id, p]));

        const result = ratings
            .map((r, index) => {
                const player = playerMap.get(r.entityId);
                if (!player) return null;
                return {
                    rank: index + 1,
                    playerId: r.entityId,
                    firstName: player.firstName,
                    lastName: player.lastName,
                    photoUrl: player.photoUrl,
                    nationality: player.nationality,
                    position: player.primaryPosition,
                    club: player.originClub,
                    ratingScore: r.score,
                    ratingComputedAt: r.computedAt,
                };
            })
            .filter(Boolean);

        return success(result);
    } catch (error) {
        return serverError(error);
    }
}

export { handleOptions as OPTIONS } from "@/lib/fan-cors";
