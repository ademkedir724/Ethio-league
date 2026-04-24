import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth, isAuthError } from "@/lib/auth";
import { success, badRequest, notFound, forbidden, serverError, parseUUID } from "@/lib/api-helpers";
import { assertLeagueScope, assertOrgScope } from "@/lib/scope-guard";

// GET /api/leagues/[id]/seasons — list seasons for a league
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth(req);
    if (isAuthError(auth)) return auth;

    const { id } = await params;
    const leagueId = parseUUID(id);
    if (!leagueId) return badRequest("Invalid league ID");

    const league = await prisma.league.findUnique({ where: { id: leagueId } });
    if (!league) return notFound("League not found");

    if (!assertLeagueScope(auth, leagueId) && !assertOrgScope(auth, league.organizationId)) {
      return forbidden();
    }

    const seasons = await prisma.season.findMany({
      where: { leagueId },
      include: {
        _count: { select: { seasonClubs: true, matches: true } },
      },
      orderBy: { startDate: "desc" },
    });

    return success(seasons);
  } catch (error) {
    return serverError(error);
  }
}
