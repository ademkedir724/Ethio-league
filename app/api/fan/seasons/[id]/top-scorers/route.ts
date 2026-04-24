import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { success, badRequest, notFound, serverError, parseUUID } from "@/lib/api-helpers";

// GET /api/fan/seasons/[id]/top-scorers
// Public — no auth required
// Query: ?limit, ?clubId
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
        const limitParam = searchParams.get("limit");
        const clubId = searchParams.get("clubId");
        const limit = limitParam ? Math.max(1, Number(limitParam)) : undefined;

        const goalEventTypes = await prisma.eventType.findMany({
            where: { name: { in: ["goal", "penalty_goal"] } },
            select: { id: true },
        });
        const goalTypeIds = goalEventTypes.map((et) => et.id);

        const events = await prisma.matchEvent.findMany({
            where: {
                eventTypeId: { in: goalTypeIds },
                match: { seasonId },
                ...(clubId && { clubId }),
            },
            select: {
                playerId: true,
                clubId: true,
                player: { select: { firstName: true, lastName: true, photoUrl: true } },
                club: { select: { id: true, name: true, logoUrl: true } },
            },
        });

        const map = new Map<string, {
            playerId: string;
            playerName: string;
            playerPhoto: string | null;
            clubId: string | null;
            clubName: string | null;
            clubLogo: string | null;
            goals: number;
        }>();

        for (const ev of events) {
            const existing = map.get(ev.playerId);
            if (existing) {
                existing.goals += 1;
            } else {
                map.set(ev.playerId, {
                    playerId: ev.playerId,
                    playerName: `${ev.player.firstName} ${ev.player.lastName}`,
                    playerPhoto: ev.player.photoUrl,
                    clubId: ev.clubId,
                    clubName: ev.club?.name ?? null,
                    clubLogo: ev.club?.logoUrl ?? null,
                    goals: 1,
                });
            }
        }

        let topScorers = Array.from(map.values()).sort((a, b) => b.goals - a.goals);
        if (limit) topScorers = topScorers.slice(0, limit);

        return success(topScorers);
    } catch (error) {
        return serverError(error);
    }
}

export { handleOptions as OPTIONS } from "@/lib/fan-cors";
