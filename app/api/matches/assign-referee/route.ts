import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth, isAuthError } from "@/lib/auth";
import { success, created, badRequest, forbidden, notFound, serverError } from "@/lib/api-helpers";
import { assertLeagueScope } from "@/lib/scope-guard";

// POST /api/matches/assign-referee — assign a referee to a match (League Admin)
// Body: { matchId, refereeId, role }
// Validates referee is in the SeasonReferee pool for the match's season.
export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuth(req, ["super_admin", "league_admin"]);
    if (isAuthError(auth)) return auth;

    const { matchId, refereeId, role } = await req.json();

    if (!matchId || !refereeId || !role) {
      return badRequest("matchId, refereeId, and role are required");
    }

    const validRoles = ["main_referee", "assistant_referee", "fourth_official", "var"];
    if (!validRoles.includes(role)) {
      return badRequest(`role must be one of: ${validRoles.join(", ")}`);
    }

    // Fetch match with season
    const match = await prisma.match.findUnique({
      where: { id: matchId },
      include: { season: true },
    });
    if (!match) return notFound("Match not found");

    // Scope check: caller must be league admin for this league
    if (!assertLeagueScope(auth, match.season.leagueId)) return forbidden();

    // Validate referee is in the SeasonReferee pool for this season
    const seasonRefereeRecord = await prisma.seasonReferee.findUnique({
      where: { refereeId_seasonId: { refereeId, seasonId: match.seasonId } },
    });
    if (!seasonRefereeRecord) {
      return badRequest("Referee is not assigned to this season. Assign them to the season first.");
    }

    const existing = await prisma.matchReferee.findUnique({
      where: { matchId_refereeId: { matchId, refereeId } },
    });
    if (existing) return badRequest("Referee already assigned to this match");

    const mr = await prisma.matchReferee.create({
      data: { matchId, refereeId, role },
      include: {
        referee: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    return created(mr);
  } catch (error) {
    return serverError(error);
  }
}
