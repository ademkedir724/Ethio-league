import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth, isAuthError } from "@/lib/auth";
import { success, badRequest, notFound, serverError, parseId } from "@/lib/api-helpers";

// GET /api/standings/:seasonId — get league table for a season
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ seasonId: string }> }
) {
  try {
    const auth = await requireAuth(req);
    if (isAuthError(auth)) return auth;

    const { seasonId: idStr } = await params;
    const seasonId = parseId({ id: idStr });
    if (!seasonId) return badRequest("Invalid season ID");

    const season = await prisma.season.findUnique({ where: { id: seasonId } });
    if (!season) return notFound("Season not found");

    const standings = await prisma.standing.findMany({
      where: { seasonId },
      include: {
        club: { select: { id: true, name: true, shortName: true, logoUrl: true } },
      },
      orderBy: [
        { points: "desc" },
        { goalDifference: "desc" },
        { goalsFor: "desc" },
      ],
    });

    return success({
      season: {
        id: season.id,
        name: season.name,
        leagueName: season.leagueName,
        status: season.status,
      },
      standings,
    });
  } catch (error) {
    return serverError(error);
  }
}

// POST /api/standings/:seasonId — recalculate standings from completed matches
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ seasonId: string }> }
) {
  try {
    const auth = await requireAuth(req, [
      "super_admin", "organization_admin", "league_admin",
    ]);
    if (isAuthError(auth)) return auth;

    const { seasonId: idStr } = await params;
    const seasonId = parseId({ id: idStr });
    if (!seasonId) return badRequest("Invalid season ID");

    const season = await prisma.season.findUnique({ where: { id: seasonId } });
    if (!season) return notFound("Season not found");

    // Get all completed matches
    const matches = await prisma.match.findMany({
      where: { seasonId, status: "completed" },
    });

    // Get all clubs in season
    const seasonClubs = await prisma.seasonClub.findMany({
      where: { seasonId },
    });

    // Build standings map
    const stats: Record<number, {
      played: number; won: number; drawn: number; lost: number;
      goalsFor: number; goalsAgainst: number;
    }> = {};

    for (const sc of seasonClubs) {
      stats[sc.clubId] = {
        played: 0, won: 0, drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0,
      };
    }

    for (const m of matches) {
      const home = stats[m.homeClubId];
      const away = stats[m.awayClubId];
      if (!home || !away) continue;

      home.played++;
      away.played++;
      home.goalsFor += m.homeScore;
      home.goalsAgainst += m.awayScore;
      away.goalsFor += m.awayScore;
      away.goalsAgainst += m.homeScore;

      if (m.homeScore > m.awayScore) {
        home.won++;
        away.lost++;
      } else if (m.homeScore < m.awayScore) {
        away.won++;
        home.lost++;
      } else {
        home.drawn++;
        away.drawn++;
      }
    }

    // Upsert standings
    for (const [clubIdStr, s] of Object.entries(stats)) {
      const clubId = Number(clubIdStr);
      const goalDifference = s.goalsFor - s.goalsAgainst;
      const points =
        s.won * season.pointsWin +
        s.drawn * season.pointsDraw +
        s.lost * season.pointsLoss;

      await prisma.standing.upsert({
        where: { seasonId_clubId: { seasonId, clubId } },
        create: {
          seasonId,
          clubId,
          ...s,
          goalDifference,
          points,
        },
        update: {
          ...s,
          goalDifference,
          points,
        },
      });
    }

    return success({ message: "Standings recalculated", matchesProcessed: matches.length });
  } catch (error) {
    return serverError(error);
  }
}
