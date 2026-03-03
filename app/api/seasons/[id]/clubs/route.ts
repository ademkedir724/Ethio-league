import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth, isAuthError, hasRole, hasOrgRole } from "@/lib/auth";
import { success, created, badRequest, notFound, serverError, parseUUID } from "@/lib/api-helpers";
import { NextResponse } from "next/server";

// GET /api/seasons/:id/clubs — list clubs in a season
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
// Body: { clubId }
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

    const season = await prisma.season.findUnique({ where: { id: seasonId } });
    if (!season) return notFound("Season not found");

    const isSuperAdmin = hasRole(auth, ["super_admin"]);
    const isOrgAdmin = hasOrgRole(auth, "organization_admin", season.organizationId);
    if (!isSuperAdmin && !isOrgAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Check if already registered
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
