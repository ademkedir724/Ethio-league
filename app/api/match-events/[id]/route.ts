import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth, isAuthError, hasRole } from "@/lib/auth";
import { success, badRequest, notFound, serverError, parseUUID } from "@/lib/api-helpers";
import { NextResponse } from "next/server";
import { assertMEASeasonScope } from "@/lib/scope-guard";
import { logAudit } from "@/lib/audit";

const TEN_MINUTES_MS = 10 * 60 * 1000;

// PATCH /api/match-events/:id — edit a match event
// Business rule: match_event_admin can edit within 10 minutes;
//                league_admin can edit anytime
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth(req, [
      "super_admin", "league_admin", "match_event_admin",
    ]);
    if (isAuthError(auth)) return auth;

    const { id: idStr } = await params;
    const id = parseUUID(idStr);
    if (!id) return badRequest("Invalid match event ID");

    const event = await prisma.matchEvent.findUnique({ where: { id } });
    if (!event) return notFound("Match event not found");

    const match = await prisma.match.findUnique({ where: { id: event.matchId }, select: { seasonId: true } });
    if (!match) return notFound("Match not found");

    // For match_event_admin: enforce season scope before time window check
    const isLeagueAdminOrHigher = hasRole(auth, ["super_admin", "league_admin"]);
    if (!isLeagueAdminOrHigher) {
      if (!assertMEASeasonScope(auth, match.seasonId)) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    // Check 10-minute window for match_event_admin
    if (!isLeagueAdminOrHigher) {
      const elapsed = Date.now() - event.createdAt.getTime();
      if (elapsed > TEN_MINUTES_MS) {
        return NextResponse.json(
          { error: "Edit window expired. Only league admins can edit after 10 minutes." },
          { status: 403 }
        );
      }
    }

    const data = await req.json();
    const allowedFields = [
      "eventTypeId", "playerId", "relatedPlayerId",
      "clubId", "minute", "extraTime", "description",
    ];
    const updateData: Record<string, unknown> = {};
    for (const field of allowedFields) {
      if (data[field] !== undefined) updateData[field] = data[field];
    }

    const updated = await prisma.matchEvent.update({
      where: { id },
      data: updateData,
      include: {
        eventType: true,
        player: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    await logAudit({
      userId: auth.userId,
      actionType: 'match_event_edited',
      targetId: id,
      targetType: 'match_event',
      description: 'Match event edited',
    });

    return success(updated);
  } catch (error) {
    return serverError(error);
  }
}

// DELETE /api/match-events/:id
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth(req, ["super_admin", "league_admin"]);
    if (isAuthError(auth)) return auth;

    const { id: idStr } = await params;
    const id = parseUUID(idStr);
    if (!id) return badRequest("Invalid match event ID");

    // Fetch the event before deleting so we know its type and club
    const event = await prisma.matchEvent.findUnique({
      where: { id },
      include: { eventType: true },
    });
    if (!event) return notFound("Match event not found");

    await prisma.matchEvent.delete({ where: { id } });

    // Recalculate score if the deleted event was a goal type
    const typeName = event.eventType.name.toLowerCase();
    const isGoal = typeName === "goal" || typeName === "penalty_goal";
    const isOwnGoal = typeName === "own_goal";

    if (isGoal || isOwnGoal) {
      const match = await prisma.match.findUnique({
        where: { id: event.matchId },
        select: { id: true, homeClubId: true, awayClubId: true },
      });
      if (match) {
        // Recount all remaining goal events for this match
        const remainingGoals = await prisma.matchEvent.findMany({
          where: {
            matchId: event.matchId,
            eventType: { name: { in: ["goal", "penalty_goal", "own_goal"] } },
          },
          include: { eventType: true },
        });

        let homeScore = 0;
        let awayScore = 0;
        for (const g of remainingGoals) {
          const gType = g.eventType.name.toLowerCase();
          const scoringClubId = gType === "own_goal"
            ? (g.clubId === match.homeClubId ? match.awayClubId : match.homeClubId)
            : g.clubId;
          if (scoringClubId === match.homeClubId) homeScore++;
          else if (scoringClubId === match.awayClubId) awayScore++;
        }

        await prisma.match.update({
          where: { id: event.matchId },
          data: { homeScore, awayScore },
        });
      }
    }

    return success({ message: "Match event deleted" });
  } catch (error) {
    return serverError(error);
  }
}
