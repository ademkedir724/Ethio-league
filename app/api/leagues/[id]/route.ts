import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth, isAuthError, hasRole, hasOrgRole } from "@/lib/auth";
import { success, badRequest, notFound, serverError, parseUUID } from "@/lib/api-helpers";

// GET /api/leagues/[id] — get league details (by season ID)
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
      return badRequest("Invalid league/season ID");
    }

    const season = await prisma.season.findUnique({
      where: { id: seasonId },
      include: {
        organization: { select: { id: true, name: true } },
        leagueType: true,
        seasonClubs: {
          include: {
            club: true,
          },
        },
        matches: {
          include: {
            homeClub: true,
            awayClub: true,
          },
          orderBy: { matchDate: "desc" },
          take: 10,
        },
        refereeLeagues: {
          include: {
            referee: true,
          },
        },
        _count: { select: { seasonClubs: true, matches: true } },
      },
    });

    if (!season) {
      return notFound("League/Season not found");
    }

    return success(season);
  } catch (error) {
    return serverError(error);
  }
}

// PATCH /api/leagues/[id] — update league/season details
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth(req);
    if (isAuthError(auth)) return auth;

    const { id } = await params;
    const seasonId = parseUUID(id);
    if (!seasonId) {
      return badRequest("Invalid league/season ID");
    }

    const season = await prisma.season.findUnique({
      where: { id: seasonId },
      select: { organizationId: true },
    });

    if (!season) {
      return notFound("League/Season not found");
    }

    // Auth check
    const isSuperAdmin = hasRole(auth, ["super_admin"]);
    const isOrgAdmin = hasOrgRole(auth, "organization_admin", season.organizationId);
    if (!isSuperAdmin && !isOrgAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const {
      name,
      leagueName,
      leagueTypeId,
      genderCategory,
      ageCategory,
      divisionLevel,
      startDate,
      endDate,
      status,
    } = body;

    const updated = await prisma.season.update({
      where: { id: seasonId },
      data: {
        ...(name && { name }),
        ...(leagueName && { leagueName }),
        ...(leagueTypeId !== undefined && { leagueTypeId }),
        ...(genderCategory !== undefined && { genderCategory }),
        ...(ageCategory !== undefined && { ageCategory }),
        ...(divisionLevel !== undefined && { divisionLevel }),
        ...(startDate && { startDate: new Date(startDate) }),
        ...(endDate && { endDate: new Date(endDate) }),
        ...(status && { status }),
      },
      include: {
        leagueType: true,
        organization: { select: { id: true, name: true } },
      },
    });

    return success(updated);
  } catch (error) {
    return serverError(error);
  }
}

// DELETE /api/leagues/[id] — delete a league/season
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth(req);
    if (isAuthError(auth)) return auth;

    const { id } = await params;
    const seasonId = parseUUID(id);
    if (!seasonId) {
      return badRequest("Invalid league/season ID");
    }

    const season = await prisma.season.findUnique({
      where: { id: seasonId },
      select: { organizationId: true },
    });

    if (!season) {
      return notFound("League/Season not found");
    }

    // Auth check
    const isSuperAdmin = hasRole(auth, ["super_admin"]);
    const isOrgAdmin = hasOrgRole(auth, "organization_admin", season.organizationId);
    if (!isSuperAdmin && !isOrgAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await prisma.season.delete({
      where: { id: seasonId },
    });

    return success({ message: "League/Season deleted successfully" });
  } catch (error) {
    return serverError(error);
  }
}
