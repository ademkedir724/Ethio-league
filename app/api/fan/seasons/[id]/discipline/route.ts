import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { success, badRequest, notFound, serverError, parseUUID } from "@/lib/api-helpers";

// GET /api/fan/seasons/[id]/discipline
// Public — no auth required
// Query: ?clubId, ?limit
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
        const clubId = searchParams.get("clubId");
        const limitParam = searchParams.get("limit");
        const limit = limitParam ? Math.max(1, Number(limitParam)) : undefined;

        // Fetch card event types
        const cardEventTypes = await prisma.eventType.findMany({
            where: { name: { in: ["yellow_card", "red_card", "second_yellow"] } },
            select: { id: true, name: true },
        });
        const yellowIds = cardEventTypes.filter((et) => et.name === "yellow_card" || et.name === "second_yellow").map((et) => et.id);
        const redIds = cardEventTypes.filter((et) => et.name === "red_card").map((et) => et.id);
        const allCardIds = cardEventTypes.map((et) => et.id);

        const events = await prisma.matchEvent.findMany({
            where: {
                eventTypeId: { in: allCardIds },
                match: { seasonId },
                ...(clubId && { clubId }),
            },
            select: {
                playerId: true,
                clubId: true,
                eventTypeId: true,
                player: { select: { firstName: true, lastName: true, photoUrl: true } },
                club: { select: { id: true, name: true, logoUrl: true } },
            },
        });

        // Aggregate by player
        const playerMap = new Map<string, {
            playerId: string;
            playerName: string;
            playerPhoto: string | null;
            clubId: string | null;
            clubName: string | null;
            yellowCards: number;
            redCards: number;
        }>();

        // Aggregate by club
        const clubMap = new Map<string, {
            clubId: string;
            clubName: string;
            clubLogo: string | null;
            yellowCards: number;
            redCards: number;
        }>();

        for (const ev of events) {
            const isYellow = yellowIds.includes(ev.eventTypeId);
            const isRed = redIds.includes(ev.eventTypeId);

            // Player aggregation
            const existing = playerMap.get(ev.playerId);
            if (existing) {
                if (isYellow) existing.yellowCards += 1;
                if (isRed) existing.redCards += 1;
            } else {
                playerMap.set(ev.playerId, {
                    playerId: ev.playerId,
                    playerName: `${ev.player.firstName} ${ev.player.lastName}`,
                    playerPhoto: ev.player.photoUrl,
                    clubId: ev.clubId,
                    clubName: ev.club?.name ?? null,
                    yellowCards: isYellow ? 1 : 0,
                    redCards: isRed ? 1 : 0,
                });
            }

            // Club aggregation
            if (ev.clubId && ev.club) {
                const existingClub = clubMap.get(ev.clubId);
                if (existingClub) {
                    if (isYellow) existingClub.yellowCards += 1;
                    if (isRed) existingClub.redCards += 1;
                } else {
                    clubMap.set(ev.clubId, {
                        clubId: ev.clubId,
                        clubName: ev.club.name,
                        clubLogo: ev.club.logoUrl,
                        yellowCards: isYellow ? 1 : 0,
                        redCards: isRed ? 1 : 0,
                    });
                }
            }
        }

        let byPlayer = Array.from(playerMap.values()).sort(
            (a, b) => (b.yellowCards + b.redCards * 2) - (a.yellowCards + a.redCards * 2)
        );
        if (limit) byPlayer = byPlayer.slice(0, limit);

        const byClub = Array.from(clubMap.values()).sort(
            (a, b) => (b.yellowCards + b.redCards * 2) - (a.yellowCards + a.redCards * 2)
        );

        return success({ byPlayer, byClub });
    } catch (error) {
        return serverError(error);
    }
}

export { handleOptions as OPTIONS } from "@/lib/fan-cors";
