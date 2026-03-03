import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth, isAuthError } from "@/lib/auth";
import { success, created, badRequest, notFound, serverError } from "@/lib/api-helpers";

// POST /api/matches/fixtures — generate round-robin fixtures for a season
// Body: { seasonId }
export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuth(req, [
      "super_admin", "organization_admin", "league_admin",
    ]);
    if (isAuthError(auth)) return auth;

    const { seasonId } = await req.json();
    if (!seasonId) return badRequest("seasonId is required");

    const season = await prisma.season.findUnique({ where: { id: seasonId } });
    if (!season) return notFound("Season not found");

    // Get all clubs in this season
    const seasonClubs = await prisma.seasonClub.findMany({
      where: { seasonId, status: "active" },
      select: { clubId: true },
    });

    const clubIds = seasonClubs.map((sc) => sc.clubId);

    if (clubIds.length < 2) {
      return badRequest("Need at least 2 clubs to generate fixtures");
    }

    // Check if fixtures already exist
    const existingMatches = await prisma.match.count({ where: { seasonId } });
    if (existingMatches > 0) {
      return badRequest("Fixtures already exist for this season. Delete them first.");
    }

    // Round-robin algorithm
    const BYE = "00000000-0000-0000-0000-000000000000";
    const teams = [...clubIds];
    if (teams.length % 2 !== 0) {
      teams.push(BYE); // bye team placeholder
    }

    const numTeams = teams.length;
    const numRounds = numTeams - 1;
    const matchesPerRound = numTeams / 2;

    const fixtures: {
      seasonId: string;
      homeClubId: string;
      awayClubId: string;
      matchDate: Date;
      roundNumber: number;
    }[] = [];

    const baseDate = new Date(season.startDate);

    for (let round = 0; round < numRounds; round++) {
      for (let match = 0; match < matchesPerRound; match++) {
        const home = teams[match];
        const away = teams[numTeams - 1 - match];

        if (home === BYE || away === BYE) continue; // skip bye

        const matchDate = new Date(baseDate);
        matchDate.setDate(matchDate.getDate() + round * 7); // 1 week apart

        fixtures.push({
          seasonId,
          homeClubId: home,
          awayClubId: away,
          matchDate,
          roundNumber: round + 1,
        });
      }

      // Rotate teams (keep first team fixed)
      const last = teams.pop()!;
      teams.splice(1, 0, last);
    }

    // Second leg (reverse home/away)
    const secondLeg = fixtures.map((f, i) => ({
      seasonId,
      homeClubId: f.awayClubId,
      awayClubId: f.homeClubId,
      matchDate: new Date(
        f.matchDate.getTime() + numRounds * 7 * 24 * 60 * 60 * 1000
      ),
      roundNumber: f.roundNumber + numRounds,
    }));

    const allFixtures = [...fixtures, ...secondLeg];

    // Bulk create matches
    const result = await prisma.match.createMany({
      data: allFixtures,
    });

    return created({
      message: `Generated ${result.count} fixtures (${fixtures.length} first leg + ${secondLeg.length} second leg)`,
      matchCount: result.count,
    });
  } catch (error) {
    return serverError(error);
  }
}
