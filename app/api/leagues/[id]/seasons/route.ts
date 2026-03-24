import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth, isAuthError, hasRole, hasOrgRole } from "@/lib/auth";
import { success, created, badRequest, notFound, serverError, parseUUID } from "@/lib/api-helpers";

// GET /api/leagues/[id]/seasons — get all seasons for a league
// The [id] is actually the first season ID, we use it to find the leagueName
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth(req);
    if (isAuthError(auth)) return auth;

    const { id } = await params;
    const seasonId = parseUUID(id);
    if (!seasonId) {
      return badRequest("Invalid league ID");
    }

    // Get the reference season to find leagueName and organizationId
    const refSeason = await prisma.season.findUnique({
      where: { id: seasonId },
      select: { leagueName: true, organizationId: true },
    });

    if (!refSeason) {
      return notFound("League not found");
    }

    // Get all seasons with the same leagueName and organizationId
    const seasons = await prisma.season.findMany({
      where: {
        leagueName: refSeason.leagueName,
        organizationId: refSeason.organizationId,
      },
      include: {
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

// POST /api/leagues/[id]/seasons — create a new season under this league
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth(req);
    if (isAuthError(auth)) return auth;

    const { id } = await params;
    const refSeasonId = parseUUID(id);
    if (!refSeasonId) {
      return badRequest("Invalid league ID");
    }

    // Get the reference season to copy league info
    const refSeason = await prisma.season.findUnique({
      where: { id: refSeasonId },
      select: {
        leagueName: true,
        organizationId: true,
        genderCategory: true,
        ageCategory: true,
        leagueTypeId: true,
        divisionLevel: true,
      },
    });

    if (!refSeason) {
      return notFound("League not found");
    }

    // Auth check
    const isSuperAdmin = hasRole(auth, ["super_admin"]);
    const isOrgAdmin = hasOrgRole(auth, "organization_admin", refSeason.organizationId);
    if (!isSuperAdmin && !isOrgAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const { name, startDate, endDate, status } = body;

    if (!name || !startDate || !endDate) {
      return badRequest("name, startDate, and endDate are required");
    }

    const season = await prisma.season.create({
      data: {
        organizationId: refSeason.organizationId,
        leagueName: refSeason.leagueName,
        name,
        genderCategory: refSeason.genderCategory,
        ageCategory: refSeason.ageCategory,
        leagueTypeId: refSeason.leagueTypeId,
        divisionLevel: refSeason.divisionLevel,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        status: status || "upcoming",
      },
      include: {
        leagueType: true,
      },
    });

    return created(season);
  } catch (error) {
    return serverError(error);
  }
}
