import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth, isAuthError } from "@/lib/auth";
import { success, created, badRequest, forbidden, serverError } from "@/lib/api-helpers";
import { assertLeagueScope } from "@/lib/scope-guard";
import { logAudit } from "@/lib/audit";

// GET /api/seasons?leagueId=X — list seasons scoped by role
export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuth(req);
    if (isAuthError(auth)) return auth;

    const leagueIdParam = req.nextUrl.searchParams.get("leagueId");
    const isSuperAdmin = auth.roles.some((r) => r.roleName === "super_admin");
    const orgAdminRole = auth.roles.find((r) => r.roleName === "organization_admin");
    const leagueAdminRole = auth.roles.find((r) => r.roleName === "league_admin");

    let where: Record<string, unknown> = {};

    if (leagueIdParam) {
      where.leagueId = leagueIdParam;
    } else if (isSuperAdmin) {
      // no filter
    } else if (orgAdminRole?.organizationId) {
      // org admin sees all seasons across their leagues
      where.league = { organizationId: orgAdminRole.organizationId };
    } else if (leagueAdminRole?.leagueId) {
      where.leagueId = leagueAdminRole.leagueId;
    } else {
      where.id = "none";
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
    const { leagueId, name, startDate, endDate, pointsWin, pointsDraw, pointsLoss } = body;

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
