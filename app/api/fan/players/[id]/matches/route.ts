import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { success, badRequest, notFound, serverError, parseUUID } from "@/lib/api-helpers";

// GET /api/fan/players/[id]/matches
// Public — no auth required
// Query: ?seasonId, ?clubId
export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const playerId = parseUUID(id);
        if (!playerId) return badRequest("Invalid player ID");

        const player = await prisma.player.findUnique({ where: { id: playerId }, select: { id: true } });
        if (!player) return notFound("Player not found");

        const { searchParams } = req.nextUrl;
        const seasonId = searchParams.get("seasonId");
        const clubId = searchParams.get("clubId");

        const lineups = await prisma.matchLineup.findMany({
            where: {
                seasonClubPlayer: {
                    playerId,
                    requestStatus: "approved",
                    ...(clubId && { seasonClub: { clubId } }),
                    ...(seasonId && { seasonClub: { seasonId } }),
                },
            },
            include: {
                match: {
                    include: {
                        homeClub: { select: { id: true, name: true, logoUrl: true } },
                        awayClub: { select: { id: true, name: true, logoUrl: true } },
                        season: { select: { id: true, name: true } },
                        stadium: { select: { id: true, name: true } },
                    },
                },
                position: { select: { id: true, name: true, code: true } },
            },
            orderBy: { match: { matchDate: "desc" } },
        });

        const appearances = lineups.map((l) => ({
            matchId: l.matchId,
            matchDate: l.match.matchDate,
            roundNumber: l.match.roundNumber,
            status: l.match.status,
            homeClub: l.match.homeClub,
            awayClub: l.match.awayClub,
            homeScore: l.match.homeScore,
            awayScore: l.match.awayScore,
            stadium: l.match.stadium,
            season: l.match.season,
            lineupType: l.lineupType,
            shirtNumber: l.shirtNumber,
            isCaptain: l.isCaptain,
            position: l.position,
        }));

        return success(appearances);
    } catch (error) {
        return serverError(error);
    }
}

export { handleOptions as OPTIONS } from "@/lib/fan-cors";
