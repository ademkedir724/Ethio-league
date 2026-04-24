import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { success, badRequest, notFound, serverError, parseUUID } from "@/lib/api-helpers";

// GET /api/fan/players/[id]
// Public — no auth required
export async function GET(
    _req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const playerId = parseUUID(id);
        if (!playerId) return badRequest("Invalid player ID");

        const player = await prisma.player.findUnique({
            where: { id: playerId },
            include: {
                primaryPosition: { select: { id: true, name: true, code: true } },
                originClub: { select: { id: true, name: true, logoUrl: true } },
                images: { orderBy: { sortOrder: "asc" } },
            },
        });

        if (!player) return notFound("Player not found");

        // Current club: most recent approved SeasonClubPlayer
        const currentSeasonClubPlayer = await prisma.seasonClubPlayer.findFirst({
            where: {
                playerId,
                requestStatus: "approved",
                seasonClub: { season: { status: { in: ["active", "completed"] } } },
            },
            include: {
                seasonClub: {
                    include: {
                        club: { select: { id: true, name: true, logoUrl: true } },
                        season: { select: { id: true, name: true, status: true } },
                    },
                },
                position: { select: { id: true, name: true, code: true } },
            },
            orderBy: { seasonClub: { season: { startDate: "desc" } } },
        });

        // Rating
        const rating = await prisma.entityRating.findUnique({
            where: { entityType_entityId: { entityType: "player", entityId: playerId } },
        });

        return success({
            ...player,
            currentClub: currentSeasonClubPlayer?.seasonClub.club ?? null,
            currentSeason: currentSeasonClubPlayer?.seasonClub.season ?? null,
            currentJerseyNumber: currentSeasonClubPlayer?.jerseyNumber ?? null,
            currentPosition: currentSeasonClubPlayer?.position ?? player.primaryPosition,
            rating: rating ?? null,
        });
    } catch (error) {
        return serverError(error);
    }
}

export { handleOptions as OPTIONS } from "@/lib/fan-cors";
