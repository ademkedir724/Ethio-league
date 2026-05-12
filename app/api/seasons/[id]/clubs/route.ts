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
        _count: {
          select: {
            players: { where: { status: "active" } },
            coaches: { where: { status: "active" } },
          },
        },
      },
    });
    return success(seasonClubs);
  } catch (error) {
    return serverError(error);
  }
}

// POST /api/seasons/:id/clubs — register one or many clubs in a season
// Body: { clubId: string } OR { clubIds: string[] }
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

    const body = await req.json();

    // Support both single clubId and bulk clubIds array
    let clubIds: string[] = [];
    if (Array.isArray(body.clubIds) && body.clubIds.length > 0) {
      clubIds = body.clubIds;
    } else if (typeof body.clubId === "string" && body.clubId) {
      clubIds = [body.clubId];
    } else {
      return badRequest("clubId or clubIds is required");
    }

    const season = await prisma.season.findUnique({
      where: { id: seasonId },
      include: { league: true },
    });
    if (!season) return notFound("Season not found");

    if (!assertLeagueScope(auth, season.leagueId) && !assertOrgScope(auth, season.league.organizationId)) {
      return forbidden();
    }

    // Find which clubs are already registered
    const existing = await prisma.seasonClub.findMany({
      where: { seasonId, clubId: { in: clubIds } },
      select: { clubId: true },
    });
    const alreadyIn = new Set(existing.map((e) => e.clubId));
    const toAdd = clubIds.filter((id) => !alreadyIn.has(id));

    if (toAdd.length === 0) {
      return badRequest("All selected clubs are already registered in this season");
    }

    // Bulk create — run sequentially to avoid interactive transaction timeout on remote DB
    const created_records: Awaited<ReturnType<typeof prisma.seasonClub.create>>[] = [];
    for (const clubId of toAdd) {
      const record = await prisma.seasonClub.create({
        data: { seasonId, clubId },
        include: { club: true },
      });
      created_records.push(record);
    }

    // Single-club backward-compat: return the single record directly
    if (clubIds.length === 1) {
      return created(created_records[0]);
    }

    return created({
      added: created_records.length,
      skipped: alreadyIn.size,
      seasonClubs: created_records,
    });
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
