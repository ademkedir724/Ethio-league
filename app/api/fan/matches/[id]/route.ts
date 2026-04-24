import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { success, badRequest, notFound, serverError, parseUUID } from "@/lib/api-helpers";

// GET /api/fan/matches/[id]
// Public — no auth required
export async function GET(
    _req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const matchId = parseUUID(id);
        if (!matchId) return badRequest("Invalid match ID");

        const match = await prisma.match.findUnique({
            where: { id: matchId },
            include: {
                homeClub: {
                    include: {
                        primaryStadium: { select: { id: true, name: true } },
                        images: { orderBy: { sortOrder: "asc" }, take: 1 },
                    },
                },
                awayClub: {
                    include: {
                        primaryStadium: { select: { id: true, name: true } },
                        images: { orderBy: { sortOrder: "asc" }, take: 1 },
                    },
                },
                stadium: {
                    include: {
                        images: { orderBy: { sortOrder: "asc" }, take: 3 },
                    },
                },
                season: {
                    include: {
                        league: { select: { id: true, name: true, logoUrl: true } },
                    },
                },
                matchReferees: {
                    include: {
                        referee: { select: { id: true, firstName: true, lastName: true, photoUrl: true } },
                    },
                },
                _count: { select: { matchEvents: true, matchLineups: true, media: true } },
            },
        });

        if (!match) return notFound("Match not found");

        return success(match);
    } catch (error) {
        return serverError(error);
    }
}

export { handleOptions as OPTIONS } from "@/lib/fan-cors";
