import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { success, serverError } from "@/lib/api-helpers";

// GET /api/fan/players
// Public — no auth required
// Query: ?search, ?nationality, ?positionId, ?clubId, ?leagueId, ?seasonId
export async function GET(req: NextRequest) {
    try {
        const { searchParams } = req.nextUrl;
        const search = searchParams.get("search");
        const nationality = searchParams.get("nationality");
        const positionId = searchParams.get("positionId");
        const clubId = searchParams.get("clubId");
        const leagueId = searchParams.get("leagueId");
        const seasonId = searchParams.get("seasonId");

        const players = await prisma.player.findMany({
            where: {
                status: "active",
                ...(search && {
                    OR: [
                        { firstName: { contains: search, mode: "insensitive" } },
                        { lastName: { contains: search, mode: "insensitive" } },
                    ],
                }),
                ...(nationality && { nationality }),
                ...(positionId && { primaryPositionId: Number(positionId) }),
                ...(clubId && { clubId }),
                ...(seasonId && {
                    seasonClubPlayers: { some: { seasonClub: { seasonId }, requestStatus: "approved" } },
                }),
                ...(leagueId && {
                    seasonClubPlayers: {
                        some: { seasonClub: { season: { leagueId } }, requestStatus: "approved" },
                    },
                }),
            },
            include: {
                primaryPosition: { select: { id: true, name: true, code: true } },
                originClub: { select: { id: true, name: true, logoUrl: true } },
            },
            orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
        });

        return success(players);
    } catch (error) {
        return serverError(error);
    }
}

export { handleOptions as OPTIONS } from "@/lib/fan-cors";
