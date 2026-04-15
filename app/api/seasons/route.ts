import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth, isAuthError } from "@/lib/auth";
import { success, created, badRequest, forbidden, serverError } from "@/lib/api-helpers";
import { assertLeagueScope } from "@/lib/scope-guard";
import { logAudit } from "@/lib/audit";

// GET /api/seasons?leagueId=X&clubId=Y — list seasons scoped by role
export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuth(req);
    if (isAuthError(auth)) return auth;

    const leagueIdParam = req.nextUrl.searchParams.get("leagueId");
    const clubIdParam = req.nextUrl.searchParams.get("clubId");
    const isSuperAdmin = auth.roles.some((r) => r.roleName === "super_admin");
    const orgAdminRole = auth.roles.find((r) => r.roleName === "organization_admin");
    const leagueAdminRole = auth.roles.find((r) => r.roleName === "league_admin");
    const clubAdminRole = auth.roles.find((r) => r.roleName === "club_admin");

    let where: Record<string, unknown> = {};

    if (clubIdParam) {
      // Return seasons where this club has a SeasonClub record
      where.seasonClubs = { some: { clubId: clubIdParam } };
    } else if (leagueIdParam) {
      where.leagueId = leagueIdParam;
    } else if (isSuperAdmin) {
      // no filter
    } else if (orgAdminRole?.organizationId) {
      where.league = { organizationId: orgAdminRole.organizationId };
    } else if (leagueAdminRole?.leagueId) {
      where.leagueId = leagueAdminRole.leagueId;
    } else if (clubAdminRole?.clubId) {
      // Club admin sees seasons their club participates in
      where.seasonClubs = { some: { clubId: clubAdminRole.clubId } };
    } else {
      // No matching scope — return empty
      return success([]);
    }

    const seasons = await prisma.season.findMany({
      where,
      include: {
        league: {
          select: {
            id: true,
            name: true,
            organization: { select: { id: true, name: true } },
          },
        },
        seasonClubs: {
          select: { id: true, clubId: true, status: true },
        },
        _count: { select: { seasonClubs: true, matches: true } },
      },
      orderBy: { startDate: "desc" },
    });

    return success(seasons);
  } catch (error) {
    return serverError(error);
  }
}

// POST /api/seasons — create a season under a league (league_admin only)
export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuth(req, ["league_admin"]);
    if (isAuthError(auth)) return auth;

    const body = await req.json();
    const { leagueId, name, startDate, endDate, pointsWin, pointsDraw, pointsLoss,
      requiredClubs, roundRobinType, daysBetweenRounds,
      minSquadSize, minStartingPlayers, maxBenchPlayers, rules } = body;

    if (!leagueId) return badRequest("leagueId is required");
    if (!name) return badRequest("name is required");
    if (!startDate || !endDate) return badRequest("startDate and endDate are required");

    // Verify league exists and caller is scoped to it
    const league = await prisma.league.findUnique({ where: { id: leagueId } });
    if (!league) return badRequest("League not found");

    if (!assertLeagueScope(auth, leagueId)) {
      return forbidden();
    }

    const season = await prisma.season.create({
      data: {
        leagueId,
        name,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        pointsWin: pointsWin ?? 3,
        pointsDraw: pointsDraw ?? 1,
        pointsLoss: pointsLoss ?? 0,
        requiredClubs: requiredClubs ? parseInt(requiredClubs) : null,
        roundRobinType: roundRobinType || "double",
        daysBetweenRounds: daysBetweenRounds ? parseInt(daysBetweenRounds) : null,
        minSquadSize: minSquadSize ?? 14,
        minStartingPlayers: minStartingPlayers ?? 11,
        maxBenchPlayers: maxBenchPlayers ?? 7,
        rules: rules || null,
      },
      include: {
        league: { select: { id: true, name: true } },
      },
    });

    await logAudit({
      userId: auth.userId,
      actionType: "season_created",
      targetId: season.id,
      targetType: "season",
      description: `Season "${season.name}" created under league "${league.name}"`,
    });

    return created(season);
  } catch (error) {
    return serverError(error);
  }
}
