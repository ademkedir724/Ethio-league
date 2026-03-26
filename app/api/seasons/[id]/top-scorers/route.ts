import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth, isAuthError } from "@/lib/auth";
import { success, badRequest, forbidden, serverError, parseUUID } from "@/lib/api-helpers";
import { assertLeagueScope, assertOrgScope } from "@/lib/scope-guard";

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

        const season = await prisma.season.findUnique({
            where: { id: seasonId },
            include: { league: true },
        });
        if (!season) return badRequest("Season not found");

        if (!assertLeagueScope(auth, season.leagueId) && !assertOrgScope(auth, season.league.organizationId)) {
            return forbidden();
        }

        // Find goal event type IDs
        const goalEventTypes = await prisma.eventType.findMany({
            where: { name: { in: ["goal", "penalty_goal"] } },
            select: { id: true },
        });
        const goalTypeIds = goalEventTypes.map((et) => et.id);

        // Fetch all goal events for completed matches in this season
        const events = await prisma.matchEvent.findMany({
            where: {
                eventTypeId: { in: goalTypeIds },
                match: { seasonId },
            },
            select: {
                playerId: true,
                clubId: true,
                player: { select: { firstName: true, lastName: true } },
                club: { select: { name: true } },
            },
        });

        // Aggregate by playerId
        const map = new Map<
            string,
            { playerId: string; playerName: string; clubId: string | null; clubName: string | null; goals: number }
        >();

        for (const ev of events) {
            const existing = map.get(ev.playerId);
            if (existing) {
                existing.goals += 1;
            } else {
                map.set(ev.playerId, {
                    playerId: ev.playerId,
                    playerName: `${ev.player.firstName} ${ev.player.lastName}`,
                    clubId: ev.clubId,
                    clubName: ev.club?.name ?? null,
                    goals: 1,
                });
            }
        }

        const topScorers = Array.from(map.values()).sort((a, b) => b.goals - a.goals);

        return success(topScorers);
    } catch (error) {
        return serverError(error);
    }
}
