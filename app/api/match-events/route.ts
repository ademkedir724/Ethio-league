import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth, isAuthError } from "@/lib/auth";
import { success, created, badRequest, notFound, serverError } from "@/lib/api-helpers";

// GET /api/match-events?matchId=X — list events for a match
export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuth(req);
    if (isAuthError(auth)) return auth;

    const matchId = req.nextUrl.searchParams.get("matchId");
    if (!matchId) return badRequest("matchId query param is required");

    const events = await prisma.matchEvent.findMany({
      where: { matchId },
      include: {
        eventType: true,
        player: { select: { id: true, firstName: true, lastName: true } },
        relatedPlayer: { select: { id: true, firstName: true, lastName: true } },
        club: { select: { id: true, name: true } },
      },
      orderBy: { minute: "asc" },
    });

    return success(events);
  } catch (error) {
    return serverError(error);
  }
}

// POST /api/match-events — log a match event (live)
// Body: { matchId, eventTypeId, playerId, relatedPlayerId?, clubId?, minute, extraTime?, description? }
export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuth(req, [
      "super_admin", "league_admin", "match_event_admin",
    ]);
    if (isAuthError(auth)) return auth;

    const body = await req.json();
    const {
      matchId, eventTypeId, playerId, relatedPlayerId,
      clubId, minute, extraTime, description,
    } = body;

    if (!matchId || !eventTypeId || !playerId || minute === undefined) {
      return badRequest("matchId, eventTypeId, playerId, and minute are required");
    }

    // Verify match is live
    const match = await prisma.match.findUnique({ where: { id: matchId } });
    if (!match) return notFound("Match not found");
    if (match.status !== "live") {
      return badRequest("Can only log events for live matches");
    }

    const event = await prisma.matchEvent.create({
      data: {
        matchId,
        eventTypeId,
        playerId,
        relatedPlayerId: relatedPlayerId || null,
        clubId: clubId || null,
        minute,
        extraTime: extraTime || null,
        description: description || null,
      },
      include: {
        eventType: true,
        player: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    return created(event);
  } catch (error) {
    return serverError(error);
  }
}
