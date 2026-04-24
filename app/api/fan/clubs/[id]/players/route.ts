import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { success, badRequest, notFound, serverError, parseUUID } from "@/lib/api-helpers";

// GET /api/fan/clubs/[id]/players
// Public — no auth required
// Query: ?seasonId, ?positionId, ?search
export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const clubId = parseUUID(id);
        if (!clubId) return badRequest("Invalid club ID");

        const club = await prisma.club.findUnique({ where: { id: clubId }, select: { id: true } });
        if (!club) return notFound("Club not found");

        const { searchParams } = req.nextUrl;
        const seasonId = searchParams.get("seasonId");
        const positionId = searchParams.get("positionId");
        const search = searchParams.get("search");

        if (seasonId) {
            // Return players registered in a specific season for this club
            const seasonClubPlayers = await prisma.seasonClubPlayer.findMany({
                where: {
                    seasonClub: { clubId, seasonId },
                    requestStatus: "approved",
                    player: {
                        ...(search && {
                            OR: [
                                { firstName: { contains: search, mode: "insensitive" } },
                                { lastName: { contains: search, mode: "insensitive" } },
                            ],
                        }),
                    },
                    ...(positionId && { positionId: Number(positionId) }),
                },
                include: {
                    player: {
                        include: {
                            primaryPosition: { select: { id: true, name: true, code: true } },
                            images: { orderBy: { sortOrder: "asc" }, take: 1 },
                        },
                    },
                    position: { select: { id: true, name: true, code: true } },
                },
                orderBy: { jerseyNumber: "asc" },
            });

            const players = seasonClubPlayers.map((scp) => ({
                playerId: scp.playerId,
                firstName: scp.player.firstName,
                lastName: scp.player.lastName,
                photoUrl: scp.player.photoUrl,
                nationality: scp.player.nationality,
                dateOfBirth: scp.player.dateOfBirth,
                heightCm: scp.player.heightCm,
                weightKg: scp.player.weightKg,
                preferredFoot: scp.player.preferredFoot,
                jerseyNumber: scp.jerseyNumber,
                playerRole: scp.playerRole,
                position: scp.position ?? scp.player.primaryPosition,
                images: scp.player.images,
            }));

            return success(players);
        }

        // No seasonId — return all players by origin club
        const players = await prisma.player.findMany({
            where: {
                clubId,
                status: "active",
                ...(search && {
                    OR: [
                        { firstName: { contains: search, mode: "insensitive" } },
                        { lastName: { contains: search, mode: "insensitive" } },
                    ],
                }),
                ...(positionId && { primaryPositionId: Number(positionId) }),
            },
            include: {
                primaryPosition: { select: { id: true, name: true, code: true } },
                images: { orderBy: { sortOrder: "asc" }, take: 1 },
            },
            orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
        });

        return success(players);
    } catch (error) {
        return serverError(error);
    }
}

export { handleOptions as OPTIONS } from "@/lib/fan-cors";
