import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { success, badRequest, notFound, serverError, parseUUID } from "@/lib/api-helpers";

// GET /api/fan/seasons/[id]/players
// Public — no auth required
// Query: ?search, ?clubId, ?positionId, ?nationality
export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const seasonId = parseUUID(id);
        if (!seasonId) return badRequest("Invalid season ID");

        const season = await prisma.season.findUnique({ where: { id: seasonId }, select: { id: true } });
        if (!season) return notFound("Season not found");

        const { searchParams } = req.nextUrl;
        const search = searchParams.get("search");
        const clubId = searchParams.get("clubId");
        const positionId = searchParams.get("positionId");
        const nationality = searchParams.get("nationality");

        const seasonClubPlayers = await prisma.seasonClubPlayer.findMany({
            where: {
                seasonClub: {
                    seasonId,
                    ...(clubId && { clubId }),
                },
                requestStatus: "approved",
                player: {
                    ...(search && {
                        OR: [
                            { firstName: { contains: search, mode: "insensitive" } },
                            { lastName: { contains: search, mode: "insensitive" } },
                        ],
                    }),
                    ...(nationality && { nationality }),
                },
                ...(positionId && { positionId: Number(positionId) }),
            },
            include: {
                player: {
                    include: {
                        primaryPosition: { select: { id: true, name: true, code: true } },
                    },
                },
                position: { select: { id: true, name: true, code: true } },
                seasonClub: {
                    include: {
                        club: { select: { id: true, name: true, logoUrl: true } },
                    },
                },
            },
            orderBy: [{ player: { lastName: "asc" } }, { player: { firstName: "asc" } }],
        });

        const players = seasonClubPlayers.map((scp) => ({
            playerId: scp.playerId,
            firstName: scp.player.firstName,
            lastName: scp.player.lastName,
            photoUrl: scp.player.photoUrl,
            nationality: scp.player.nationality,
            dateOfBirth: scp.player.dateOfBirth,
            jerseyNumber: scp.jerseyNumber,
            playerRole: scp.playerRole,
            position: scp.position ?? scp.player.primaryPosition,
            club: scp.seasonClub.club,
        }));

        return success(players);
    } catch (error) {
        return serverError(error);
    }
}

export { handleOptions as OPTIONS } from "@/lib/fan-cors";
