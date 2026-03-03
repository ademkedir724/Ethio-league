import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth, isAuthError, hasRole, hasOrgRole } from "@/lib/auth";
import { success, created, badRequest, serverError } from "@/lib/api-helpers";
import { NextResponse } from "next/server";

// GET /api/seasons?organizationId=X — list seasons, optionally filter by org
export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuth(req);
    if (isAuthError(auth)) return auth;

    const orgId = req.nextUrl.searchParams.get("organizationId");

    const where = orgId ? { organizationId: Number(orgId) } : {};

    const seasons = await prisma.season.findMany({
      where,
      include: {
        organization: { select: { id: true, name: true } },
        leagueType: true,
        _count: { select: { seasonClubs: true, matches: true } },
      },
      orderBy: { startDate: "desc" },
    });
    return success(seasons);
  } catch (error) {
    return serverError(error);
  }
}

// POST /api/seasons — create a new season (organization_admin or super_admin)
export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuth(req);
    if (isAuthError(auth)) return auth;

    const body = await req.json();
    const {
      organizationId,
      name,
      leagueName,
      leagueTypeId,
      genderCategory,
      ageCategory,
      divisionLevel,
      startDate,
      endDate,
      pointsWin,
      pointsDraw,
      pointsLoss,
    } = body;

    if (!organizationId || !name || !leagueName || !startDate || !endDate) {
      return badRequest(
        "organizationId, name, leagueName, startDate, and endDate are required"
      );
    }

    // Auth check: super_admin or org admin of the org
    const isSuperAdmin = hasRole(auth, ["super_admin"]);
    const isOrgAdmin = hasOrgRole(auth, "organization_admin", organizationId);
    if (!isSuperAdmin && !isOrgAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const season = await prisma.season.create({
      data: {
        organizationId,
        name,
        leagueName,
        leagueTypeId: leagueTypeId || null,
        genderCategory: genderCategory || null,
        ageCategory: ageCategory || null,
        divisionLevel: divisionLevel || null,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        pointsWin: pointsWin ?? 3,
        pointsDraw: pointsDraw ?? 1,
        pointsLoss: pointsLoss ?? 0,
      },
      include: { leagueType: true },
    });

    return created(season);
  } catch (error) {
    return serverError(error);
  }
}
