import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth, isAuthError } from "@/lib/auth";
import { success, created, badRequest, serverError } from "@/lib/api-helpers";

// GET /api/stadiums
export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuth(req);
    if (isAuthError(auth)) return auth;

    const stadiums = await prisma.stadium.findMany({
      include: {
        ownerClub: { select: { id: true, name: true } },
      },
      orderBy: { name: "asc" },
    });
    return success(stadiums);
  } catch (error) {
    return serverError(error);
  }
}

// POST /api/stadiums
export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuth(req, [
      "super_admin", "organization_admin", "club_admin",
    ]);
    if (isAuthError(auth)) return auth;

    const body = await req.json();
    const { name, city, country, capacity, surfaceType, builtYear, ownerClubId, description } = body;

    if (!name) return badRequest("Stadium name is required");

    const stadium = await prisma.stadium.create({
      data: {
        name,
        city: city || null,
        country: country || null,
        capacity: capacity || null,
        surfaceType: surfaceType || null,
        builtYear: builtYear || null,
        ownerClubId: ownerClubId || null,
        description: description || null,
      },
    });

    return created(stadium);
  } catch (error) {
    return serverError(error);
  }
}
