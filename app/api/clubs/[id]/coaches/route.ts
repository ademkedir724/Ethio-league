import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth, isAuthError, hasRole, hasClubRole } from "@/lib/auth";
import { success, created, badRequest, notFound, serverError, parseId } from "@/lib/api-helpers";
import { NextResponse } from "next/server";

// GET /api/clubs/:id/coaches?seasonId=X — list coaches for a club in a season
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth(req);
    if (isAuthError(auth)) return auth;

    const { id: idStr } = await params;
    const clubId = parseId({ id: idStr });
    if (!clubId) return badRequest("Invalid club ID");

    const seasonId = req.nextUrl.searchParams.get("seasonId");
    if (!seasonId) return badRequest("seasonId query param is required");

    const seasonClub = await prisma.seasonClub.findUnique({
      where: { seasonId_clubId: { seasonId: Number(seasonId), clubId } },
    });
    if (!seasonClub) return notFound("Club not registered in this season");

    const coaches = await prisma.seasonClubCoach.findMany({
      where: { seasonClubId: seasonClub.id },
      include: { coach: true },
    });

    return success(coaches);
  } catch (error) {
    return serverError(error);
  }
}

// POST /api/clubs/:id/coaches — assign a coach to club for a season
// Body: { seasonId, coachId, role?, startDate?, endDate? }
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth(req);
    if (isAuthError(auth)) return auth;

    const { id: idStr } = await params;
    const clubId = parseId({ id: idStr });
    if (!clubId) return badRequest("Invalid club ID");

    const isSuperAdmin = hasRole(auth, ["super_admin"]);
    const isClubAdmin = hasClubRole(auth, "club_admin", clubId);
    const isOrgAdmin = hasRole(auth, ["organization_admin"]);
    if (!isSuperAdmin && !isClubAdmin && !isOrgAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const { seasonId, coachId, role, startDate, endDate } = body;

    if (!seasonId || !coachId) {
      return badRequest("seasonId and coachId are required");
    }

    const seasonClub = await prisma.seasonClub.findUnique({
      where: { seasonId_clubId: { seasonId, clubId } },
    });
    if (!seasonClub) return notFound("Club not registered in this season");

    const scc = await prisma.seasonClubCoach.create({
      data: {
        seasonClubId: seasonClub.id,
        coachId,
        role: role || "head_coach",
        startDate: startDate ? new Date(startDate) : null,
        endDate: endDate ? new Date(endDate) : null,
      },
      include: { coach: true },
    });

    return created(scc);
  } catch (error) {
    return serverError(error);
  }
}
