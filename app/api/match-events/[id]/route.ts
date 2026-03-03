import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth, isAuthError, hasRole } from "@/lib/auth";
import { success, badRequest, notFound, serverError, parseUUID } from "@/lib/api-helpers";
import { NextResponse } from "next/server";

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

    // Check 10-minute window for match_event_admin
    const isLeagueAdminOrHigher = hasRole(auth, ["super_admin", "league_admin"]);
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

    await prisma.matchEvent.delete({ where: { id } });
    return success({ message: "Match event deleted" });
  } catch (error) {
    return serverError(error);
  }
}
