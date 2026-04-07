import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth, isAuthError } from "@/lib/auth";
import { success, created, badRequest, notFound, forbidden, serverError } from "@/lib/api-helpers";
import { assertMEASeasonScope } from "@/lib/scope-guard";
import { logAudit } from "@/lib/audit";

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

    // Scope check: user must be scoped to this season
    if (!assertMEASeasonScope(auth, match.seasonId)) return forbidden();

    // Verify player is approved in this season's squad
    const seasonClub = await prisma.seasonClub.findFirst({
      where: {
        seasonId: match.seasonId,
        clubId: clubId || undefined,
      },
    });
    if (seasonClub) {
      const scp = await prisma.seasonClubPlayer.findFirst({
        where: {
          seasonClubId: seasonClub.id,
          playerId,
        },
      });
      if (scp && scp.requestStatus !== "approved") {
        return badRequest("Player is not approved in this season's squad and cannot be used in match events");
      }
    }

    // Look up event type before creating the event
    const eventType = await prisma.eventType.findUnique({
      where: { id: eventTypeId },
      select: { name: true },
    });
    if (!eventType) return notFound("Event type not found");

    // Substitution requires relatedPlayerId
    if (eventType.name === "substitution" && !relatedPlayerId) {
      return badRequest("relatedPlayerId is required for substitution events");
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

    // Auto-increment score based on event type
    if (eventType.name === "goal" || eventType.name === "penalty_goal") {
      if (clubId === match.homeClubId) {
        await prisma.match.update({ where: { id: matchId }, data: { homeScore: { increment: 1 } } });
      } else if (clubId === match.awayClubId) {
        await prisma.match.update({ where: { id: matchId }, data: { awayScore: { increment: 1 } } });
      }
    } else if (eventType.name === "own_goal") {
      if (clubId === match.homeClubId) {
        // Own goal by home team — increment away score
        await prisma.match.update({ where: { id: matchId }, data: { awayScore: { increment: 1 } } });
      } else if (clubId === match.awayClubId) {
        // Own goal by away team — increment home score
        await prisma.match.update({ where: { id: matchId }, data: { homeScore: { increment: 1 } } });
      }
    }

    // Notify league admin for this season — find via season → league → league_admin scope
    const seasonForNotif = await prisma.season.findUnique({
      where: { id: match.seasonId },
      select: { leagueId: true },
    });

    if (seasonForNotif) {
      const leagueAdminScope = await prisma.userRoleScope.findFirst({
        where: {
          leagueId: seasonForNotif.leagueId,
          role: { name: "league_admin" },
        },
        include: { role: true },
      });

      if (leagueAdminScope) {
        await prisma.notification.create({
          data: {
            userId: leagueAdminScope.userId,
            title: "Match Event Logged",
            body: `A ${eventType.name} event was logged for match ${matchId}`,
          },
        });
      }
    }

    // Audit log
    await logAudit({
      userId: auth.userId,
      actionType: "match_event_created",
      targetId: event.id,
      targetType: "match_event",
      description: "Match event logged",
    });

    return created(event);
  } catch (error) {
    return serverError(error);
  }
}
