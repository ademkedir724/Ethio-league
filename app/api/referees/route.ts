import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth, isAuthError } from "@/lib/auth";
import { success, created, badRequest, serverError } from "@/lib/api-helpers";

// GET /api/referees
export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuth(req);
    if (isAuthError(auth)) return auth;

    const referees = await prisma.referee.findMany({
      orderBy: { lastName: "asc" },
    });
    return success(referees);
  } catch (error) {
    return serverError(error);
  }
}

// POST /api/referees
export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuth(req, [
      "super_admin", "organization_admin", "league_admin",
    ]);
    if (isAuthError(auth)) return auth;

    const body = await req.json();
    const {
      firstName, lastName, dateOfBirth, nationality,
      licenseLevel, experienceYears, photoUrl,
    } = body;

    if (!firstName || !lastName) {
      return badRequest("firstName and lastName are required");
    }

    const referee = await prisma.referee.create({
      data: {
        firstName,
        lastName,
        dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null,
        nationality: nationality || null,
        licenseLevel: licenseLevel || null,
        experienceYears: experienceYears || null,
        photoUrl: photoUrl || null,
      },
    });

    return created(referee);
  } catch (error) {
    return serverError(error);
  }
}
