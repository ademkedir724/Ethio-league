import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth, isAuthError } from "@/lib/auth";
import { success, badRequest, forbidden, serverError, parseUUID } from "@/lib/api-helpers";
import { assertSeasonScope } from "@/lib/scope-guard";

export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const auth = await requireAuth(req);
        if (isAuthError(auth)) return auth;

        const { id } = await params;
        const seasonId = parseUUID(id);
        if (!seasonId) return badRequest("Invalid season ID");

        if (!assertSeasonScope(auth, seasonId)) return forbidden();

        // Find card event type IDs
        const cardEventTypes = await prisma.eventType.findMany({
            where: { name: { in: ["yellow_card", "red_card"] } },
            select: { id: true, name: true },
        });

        const yellowId = cardEventTypes.find((et) => et.name === "yellow_card")?.id;
        const redId = cardEventTypes.find((et) => et.name === "red_card")?.id;
        const cardTypeIds = cardEventTypes.map((et) => et.id);

        // Fetch all card events for matches in this season
        const events = await prisma.matchEvent.findMany({
            where: {
                eventTypeId: { in: cardTypeIds },
                match: { seasonId },
            },
            select: {
                playerId: true,
                clubId: true,
                eventTypeId: true,
                player: { select: { firstName: true, lastName: true } },
                club: { select: { name: true } },
            },
        });

        // Aggregate by player
        const playerMap = new Map<
            string,
            { playerId: string; playerName: string; clubId: string | null; clubName: string | null; yellowCards: number; redCards: number }
        >();

        // Aggregate by club
        const clubMap = new Map<
            string,
            { clubId: string; clubName: string; yellowCards: number; redCards: number }
        >();

        for (const ev of events) {
            const isYellow = ev.eventTypeId === yellowId;
            const isRed = ev.eventTypeId === redId;

            // Player aggregation
            const existing = playerMap.get(ev.playerId);
            if (existing) {
                if (isYellow) existing.yellowCards += 1;
                if (isRed) existing.redCards += 1;
            } else {
                playerMap.set(ev.playerId, {
                    playerId: ev.playerId,
                    playerName: `${ev.player.firstName} ${ev.player.lastName}`,
                    clubId: ev.clubId,
                    clubName: ev.club?.name ?? null,
                    yellowCards: isYellow ? 1 : 0,
                    redCards: isRed ? 1 : 0,
                });
            }

            // Club aggregation
            if (ev.clubId) {
                const existingClub = clubMap.get(ev.clubId);
                if (existingClub) {
                    if (isYellow) existingClub.yellowCards += 1;
                    if (isRed) existingClub.redCards += 1;
                } else {
                    clubMap.set(ev.clubId, {
                        clubId: ev.clubId,
                        clubName: ev.club?.name ?? "",
                        yellowCards: isYellow ? 1 : 0,
                        redCards: isRed ? 1 : 0,
                    });
                }
            }
        }

        return success({
            byPlayer: Array.from(playerMap.values()),
            byClub: Array.from(clubMap.values()),
        });
    } catch (error) {
        return serverError(error);
    }
}
