import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { success, badRequest, notFound, serverError, parseUUID } from "@/lib/api-helpers";

// GET /api/fan/matches/[id]/events
// Public — no auth required
export async function GET(
    _req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const matchId = parseUUID(id);
        if (!matchId) return badRequest("Invalid match ID");

        const match = await prisma.match.findUnique({ where: { id: matchId }, select: { id: true } });
        if (!match) return notFound("Match not found");

        const events = await prisma.matchEvent.findMany({
            where: { matchId },
            include: {
                eventType: { select: { id: true, name: true } },
                player: { select: { id: true, firstName: true, lastName: true, photoUrl: true } },
                relatedPlayer: { select: { id: true, firstName: true, lastName: true, photoUrl: true } },
                club: { select: { id: true, name: true, logoUrl: true } },
            },
            orderBy: [{ minute: "asc" }, { extraTime: "asc" }],
        });

        return success(events);
    } catch (error) {
        return serverError(error);
    }
}

export { handleOptions as OPTIONS } from "@/lib/fan-cors";
