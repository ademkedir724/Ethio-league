import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth, isAuthError } from "@/lib/auth";
import { success, badRequest, notFound, serverError, parseUUID } from "@/lib/api-helpers";
import { destroyAsset, extractPublicId } from "@/lib/cloudinary";
import { broadcastMatchEvent, PUSHER_EVENTS } from "@/lib/pusher";

// GET /api/matches/:id
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth(req);
    if (isAuthError(auth)) return auth;

    const { id: idStr } = await params;
    const id = parseUUID(idStr);
    if (!id) return badRequest("Invalid match ID");

    const match = await prisma.match.findUnique({
      where: { id },
      include: {
        homeClub: true,
        awayClub: true,
        stadium: true,
        season: { select: { id: true, name: true, leagueId: true } },
        matchEvents: {
          include: {
            eventType: true,
            player: { select: { id: true, firstName: true, lastName: true } },
            relatedPlayer: { select: { id: true, firstName: true, lastName: true } },
          },
          orderBy: { minute: "asc" },
        },
        matchReferees: {
          include: {
            referee: { select: { id: true, firstName: true, lastName: true } },
          },
        },
        matchLineups: {
          include: {
            seasonClubPlayer: {
              include: {
                player: { select: { id: true, firstName: true, lastName: true } },
              },
            },
            position: true,
          },
        },
      },
    });

    if (!match) return notFound("Match not found");

    // Fetch MEAs for this match via raw SQL (new table, client may be stale)
    const matchMEAs = await prisma.$queryRaw<Array<{ id: string; userId: string; fullName: string; email: string }>>`
      SELECT mm.id, mm."userId", u."fullName", u.email
      FROM match_meas mm
      JOIN users u ON u.id = mm."userId"
      WHERE mm."matchId" = ${id}::uuid
    `;

    return success({ ...match, matchMEAs: matchMEAs.map((m) => ({ id: m.id, user: { id: m.userId, fullName: m.fullName, email: m.email } })) });
  } catch (error) {
    return serverError(error);
  }
}

// PATCH /api/matches/:id — update match (status, score, date, etc.)
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth(req, [
      "super_admin", "organization_admin", "league_admin", "match_event_admin",
    ]);
    if (isAuthError(auth)) return auth;

    const { id: idStr } = await params;
    const id = parseUUID(idStr);
    if (!id) return badRequest("Invalid match ID");

    const data = await req.json();

    // Validate status transitions
    if (data.status) {
      const current = await prisma.match.findUnique({ where: { id }, select: { status: true, seasonId: true } });
      if (!current) return notFound("Match not found");

      const isMEA = auth.roles.some((r) => r.roleName === "match_event_admin");
      const isPrivileged = auth.roles.some((r) => r.roleName === "super_admin" || r.roleName === "league_admin");

      // MEA can only: approved → live, live → completed
      if (isMEA && !isPrivileged) {
        const validTransitions: Record<string, string> = { approved: "live", live: "completed" };
        if (validTransitions[current.status] !== data.status) {
          return badRequest(`Cannot transition match from '${current.status}' to '${data.status}'`);
        }
      }
    }

    const allowedFields = [
      "stadiumId", "matchDate", "roundNumber", "status",
      "homeScore", "awayScore", "attendance", "liveStartedAt",
    ];
    const updateData: Record<string, unknown> = {};
    for (const field of allowedFields) {
      if (data[field] !== undefined) {
        if (field === "matchDate") {
          updateData[field] = new Date(data[field]);
        } else {
          updateData[field] = data[field];
        }
      }
    }

    const match = await prisma.match.update({
      where: { id },
      data: updateData,
    });

    // Broadcast status and score changes to fan site
    if (data.status !== undefined) {
      broadcastMatchEvent(PUSHER_EVENTS.STATUS_CHANGED, id, {
        matchId: id,
        status: match.status,
        liveStartedAt: match.liveStartedAt?.toISOString() ?? null,
      });
    }
    if (data.homeScore !== undefined || data.awayScore !== undefined) {
      broadcastMatchEvent(PUSHER_EVENTS.SCORE_UPDATED, id, {
        matchId: id,
        homeScore: match.homeScore ?? 0,
        awayScore: match.awayScore ?? 0,
      });
    }

    return success(match);
  } catch (error) {
    return serverError(error);
  }
}

// DELETE /api/matches/:id
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth(req, ["super_admin", "league_admin"]);
    if (isAuthError(auth)) return auth;

    const { id: idStr } = await params;
    const id = parseUUID(idStr);
    if (!id) return badRequest("Invalid match ID");

    const media = await prisma.matchMedia.findMany({ where: { matchId: id }, select: { mediaUrl: true } });
    await Promise.all(media.map((m) => destroyAsset(extractPublicId(m.mediaUrl))));

    await prisma.match.delete({ where: { id } });
    return success({ message: "Match deleted" });
  } catch (error) {
    return serverError(error);
  }
}
