import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth, isAuthError } from "@/lib/auth";
import { success, created, badRequest, serverError, parsePagination, paginated } from "@/lib/api-helpers";

// GET /api/matches?seasonId=X&status=Y&page=1&limit=20
export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuth(req);
    if (isAuthError(auth)) return auth;

    const sp = req.nextUrl.searchParams;
    const seasonId = sp.get("seasonId");
    const status = sp.get("status");
    const { page, limit, skip } = parsePagination(sp, 20, 10, 25);

    const where: Record<string, unknown> = {};
    if (seasonId) where.seasonId = seasonId;
    if (status) where.status = status;

    const isLeagueAdmin = auth.roles.some((r) => r.roleName === "league_admin");
    const isMEA = auth.roles.some((r) => r.roleName === "match_event_admin");
    const isClubAdmin = auth.roles.some((r) => r.roleName === "club_admin");

    if (isLeagueAdmin && !seasonId) {
      const leagueId = auth.roles.find((r) => r.roleName === "league_admin")?.leagueId;
      if (leagueId) where.season = { leagueId };
    } else if (isMEA && !seasonId) {
      const meaSeasonIds = auth.roles
        .filter((r) => r.roleName === "match_event_admin" && r.seasonId)
        .map((r) => r.seasonId as string);
      if (meaSeasonIds.length > 0) where.seasonId = { in: meaSeasonIds };
    } else if (isClubAdmin) {
      const clubId = auth.roles.find((r) => r.roleName === "club_admin")?.clubId;
      if (clubId) where.OR = [{ homeClubId: clubId }, { awayClubId: clubId }];
    }

    const include = {
      homeClub: { select: { id: true, name: true, shortName: true, logoUrl: true } },
      awayClub: { select: { id: true, name: true, shortName: true, logoUrl: true } },
      stadium: { select: { id: true, name: true } },
      season: { select: { id: true, name: true, leagueId: true } },
      _count: { select: { matchEvents: true, matchReferees: true } },
    };

    const [total, matches] = await Promise.all([
      prisma.match.count({ where }),
      prisma.match.findMany({ where, include, orderBy: { matchDate: "asc" }, skip, take: limit }),
    ]);

    return paginated(matches, total, page, limit);
  } catch (error) {
    return serverError(error);
  }
}

// POST /api/matches — create a single match
export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuth(req, [
      "super_admin", "organization_admin", "league_admin",
    ]);
    if (isAuthError(auth)) return auth;

    const body = await req.json();
    const {
      seasonId, homeClubId, awayClubId, stadiumId,
      matchDate, roundNumber,
    } = body;

    if (!seasonId || !homeClubId || !awayClubId || !matchDate) {
      return badRequest("seasonId, homeClubId, awayClubId, and matchDate are required");
    }

    if (homeClubId === awayClubId) {
      return badRequest("Home and away clubs must be different");
    }

    const match = await prisma.match.create({
      data: {
        seasonId,
        homeClubId,
        awayClubId,
        stadiumId: stadiumId || null,
        matchDate: new Date(matchDate),
        roundNumber: roundNumber || null,
      },
      include: {
        homeClub: { select: { id: true, name: true } },
        awayClub: { select: { id: true, name: true } },
      },
    });

    return created(match);
  } catch (error) {
    return serverError(error);
  }
}
