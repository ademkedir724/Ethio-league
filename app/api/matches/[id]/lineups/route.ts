import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth, isAuthError } from "@/lib/auth";
import { success, created, badRequest, notFound, serverError, parseId } from "@/lib/api-helpers";

// GET /api/matches/:id/lineups — get lineups for a match
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth(req);
    if (isAuthError(auth)) return auth;

    const { id: idStr } = await params;
    const matchId = parseId({ id: idStr });
    if (!matchId) return badRequest("Invalid match ID");

    const lineups = await prisma.matchLineup.findMany({
      where: { matchId },
      include: {
        seasonClubPlayer: {
          include: {
            player: { select: { id: true, firstName: true, lastName: true } },
            seasonClub: {
              include: { club: { select: { id: true, name: true } } },
            },
          },
        },
        position: true,
      },
      orderBy: [{ lineupType: "asc" }, { shirtNumber: "asc" }],
    });

    return success(lineups);
  } catch (error) {
    return serverError(error);
  }
}

// POST /api/matches/:id/lineups — submit lineup entries
// Body: { lineups: [{ seasonClubPlayerId, clubId?, positionId?, lineupType?, shirtNumber?, isCaptain? }] }
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth(req, [
      "super_admin", "organization_admin", "league_admin", "club_admin",
    ]);
    if (isAuthError(auth)) return auth;

    const { id: idStr } = await params;
    const matchId = parseId({ id: idStr });
    if (!matchId) return badRequest("Invalid match ID");

    const match = await prisma.match.findUnique({ where: { id: matchId } });
    if (!match) return notFound("Match not found");

    const { lineups } = await req.json();
    if (!Array.isArray(lineups) || lineups.length === 0) {
      return badRequest("lineups array is required");
    }

    const createdLineups = [];
    for (const entry of lineups) {
      const lineup = await prisma.matchLineup.upsert({
        where: {
          matchId_seasonClubPlayerId: {
            matchId,
            seasonClubPlayerId: entry.seasonClubPlayerId,
          },
        },
        create: {
          matchId,
          seasonClubPlayerId: entry.seasonClubPlayerId,
          clubId: entry.clubId || null,
          positionId: entry.positionId || null,
          lineupType: entry.lineupType || "starting",
          shirtNumber: entry.shirtNumber || null,
          isCaptain: entry.isCaptain || false,
        },
        update: {
          positionId: entry.positionId || undefined,
          lineupType: entry.lineupType || undefined,
          shirtNumber: entry.shirtNumber || undefined,
          isCaptain: entry.isCaptain || undefined,
        },
      });
      createdLineups.push(lineup);
    }

    return created(createdLineups);
  } catch (error) {
    return serverError(error);
  }
}
