import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth, isAuthError, hasRole, hasClubRole } from "@/lib/auth";
import { success, created, badRequest, notFound, serverError, parseUUID } from "@/lib/api-helpers";
import { NextResponse } from "next/server";

// GET /api/clubs/:id/players?seasonId=X — list players for a club in a season
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth(req);
    if (isAuthError(auth)) return auth;

    const { id: idStr } = await params;
    const clubId = parseUUID(idStr);
    if (!clubId) return badRequest("Invalid club ID");

    const seasonId = req.nextUrl.searchParams.get("seasonId");
    if (!seasonId) return badRequest("seasonId query param is required");

    const seasonClub = await prisma.seasonClub.findUnique({
      where: { seasonId_clubId: { seasonId, clubId } },
    });
    if (!seasonClub) return notFound("Club not registered in this season");

    const players = await prisma.seasonClubPlayer.findMany({
      where: { seasonClubId: seasonClub.id },
      include: {
        player: true,
        position: true,
      },
    });

    return success(players);
  } catch (error) {
    return serverError(error);
  }
}

// POST /api/clubs/:id/players — register a player for a club in a season
// Body: { seasonId, playerId, jerseyNumber?, positionId?, contractStart?, contractEnd? }
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth(req);
    if (isAuthError(auth)) return auth;

    const { id: idStr } = await params;
    const clubId = parseUUID(idStr);
    if (!clubId) return badRequest("Invalid club ID");

    const isSuperAdmin = hasRole(auth, ["super_admin"]);
    const isClubAdmin = hasClubRole(auth, "club_admin", clubId);
    const isOrgAdmin = hasRole(auth, ["organization_admin"]);
    if (!isSuperAdmin && !isClubAdmin && !isOrgAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const { seasonId, playerId, jerseyNumber, positionId, contractStart, contractEnd } = body;

    if (!seasonId || !playerId) {
      return badRequest("seasonId and playerId are required");
    }

    const seasonClub = await prisma.seasonClub.findUnique({
      where: { seasonId_clubId: { seasonId, clubId } },
    });
    if (!seasonClub) return notFound("Club not registered in this season");

    // Check if player already registered in this season-club
    const existing = await prisma.seasonClubPlayer.findUnique({
      where: { seasonClubId_playerId: { seasonClubId: seasonClub.id, playerId } },
    });
    if (existing) return badRequest("Player already registered for this club in this season");

    const scp = await prisma.seasonClubPlayer.create({
      data: {
        seasonClubId: seasonClub.id,
        playerId,
        jerseyNumber: jerseyNumber || null,
        positionId: positionId || null,
        contractStart: contractStart ? new Date(contractStart) : null,
        contractEnd: contractEnd ? new Date(contractEnd) : null,
      },
      include: { player: true, position: true },
    });

    return created(scp);
  } catch (error) {
    return serverError(error);
  }
}
