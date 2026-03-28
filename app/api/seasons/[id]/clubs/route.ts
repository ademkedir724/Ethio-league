import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth, isAuthError } from "@/lib/auth";
import { success, created, badRequest, notFound, forbidden, serverError, parseUUID } from "@/lib/api-helpers";
import { assertLeagueScope, assertOrgScope } from "@/lib/scope-guard";

// GET /api/seasons/:id/clubs
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth(req);
    if (isAuthError(auth)) return auth;

    const { id: idStr } = await params;
    const seasonId = parseUUID(idStr);
    if (!seasonId) return badRequest("Invalid season ID");

    const seasonClubs = await prisma.seasonClub.findMany({
      where: { seasonId },
      include: {
        club: true,
        _count: { select: { players: true, coaches: true } },
      },
    });
    return success(seasonClubs);
  } catch (error) {
    return serverError(error);
  }
}

// POST /api/seasons/:id/clubs — register a club in a season
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth(req);
    if (isAuthError(auth)) return auth;

    const { id: idStr } = await params;
    const seasonId = parseUUID(idStr);
    if (!seasonId) return badRequest("Invalid season ID");

    const { clubId } = await req.json();
    if (!clubId) return badRequest("clubId is required");

    const season = await prisma.season.findUnique({
      where: { id: seasonId },
      include: { league: true },
    });
    if (!season) return notFound("Season not found");

    if (!assertLeagueScope(auth, season.leagueId) && !assertOrgScope(auth, season.league.organizationId)) {
      return forbidden();
    }

    const existing = await prisma.seasonClub.findUnique({
      where: { seasonId_clubId: { seasonId, clubId } },
    });
    if (existing) return badRequest("Club already registered in this season");

    const seasonClub = await prisma.seasonClub.create({
      data: { seasonId, clubId },
      include: { club: true },
    });

    return created(seasonClub);
  } catch (error) {
    return serverError(error);
  }
}

// DELETE /api/seasons/:id/clubs — remove a club from a season
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth(req);
    if (isAuthError(auth)) return auth;

    const { id: idStr } = await params;
    const seasonId = parseUUID(idStr);
    if (!seasonId) return badRequest("Invalid season ID");

    const { clubId } = await req.json();
    if (!clubId) return badRequest("clubId is required");

    const season = await prisma.season.findUnique({
      where: { id: seasonId },
      include: { league: true },
    });
    if (!season) return notFound("Season not found");

    if (!assertLeagueScope(auth, season.leagueId) && !assertOrgScope(auth, season.league.organizationId)) {
      return forbidden();
    }

    await prisma.seasonClub.delete({
      where: { seasonId_clubId: { seasonId, clubId } },
    });

    return success({ message: "Club removed from season" });
  } catch (error) {
    return serverError(error);
  }
}
