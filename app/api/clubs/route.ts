import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth, isAuthError } from "@/lib/auth";
import { success, created, badRequest, serverError } from "@/lib/api-helpers";

// GET /api/clubs — list all clubs
export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuth(req);
    if (isAuthError(auth)) return auth;

    const clubs = await prisma.club.findMany({
      include: {
        primaryStadium: { select: { id: true, name: true } },
        _count: { select: { seasonClubs: true } },
      },
      orderBy: { name: "asc" },
    });
    return success(clubs);
  } catch (error) {
    return serverError(error);
  }
}

// POST /api/clubs — create a club (super_admin or organization_admin)
export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuth(req, ["super_admin", "organization_admin"]);
    if (isAuthError(auth)) return auth;

    const body = await req.json();
    const {
      name, shortName, country, city, foundedYear,
      logoUrl, primaryStadiumId, website, description,
    } = body;

    if (!name) return badRequest("Club name is required");

    const club = await prisma.club.create({
      data: {
        name,
        shortName: shortName || null,
        country: country || null,
        city: city || null,
        foundedYear: foundedYear || null,
        logoUrl: logoUrl || null,
        primaryStadiumId: primaryStadiumId || null,
        website: website || null,
        description: description || null,
      },
    });

    return created(club);
  } catch (error) {
    return serverError(error);
  }
}
