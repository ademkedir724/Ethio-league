import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth, isAuthError } from "@/lib/auth";
import { success, badRequest, notFound, serverError, parseUUID } from "@/lib/api-helpers";

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
        season: { select: { id: true, name: true, leagueName: true, organizationId: true } },
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
    return success(match);
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
    const allowedFields = [
      "stadiumId", "matchDate", "roundNumber", "status",
      "homeScore", "awayScore", "attendance",
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

    await prisma.match.delete({ where: { id } });
    return success({ message: "Match deleted" });
  } catch (error) {
    return serverError(error);
  }
}
