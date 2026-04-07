import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth, isAuthError } from "@/lib/auth";
import { success, created, badRequest, serverError } from "@/lib/api-helpers";

// GET /api/coaches — list coaches (scope-filtered by role)
export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuth(req);
    if (isAuthError(auth)) return auth;

    const where: Record<string, unknown> = {};

    const isClubAdmin = auth.roles.some((r) => r.roleName === "club_admin");
    const isOrgAdmin = auth.roles.some((r) => r.roleName === "organization_admin");

    if (isClubAdmin) {
      // Return all coaches whose origin club is this club (the full club pool)
      const clubId = auth.roles.find((r) => r.roleName === "club_admin")?.clubId;
      if (clubId) {
        where.clubId = clubId;
      }
    } else if (isOrgAdmin) {
      const orgId = auth.roles.find((r) => r.roleName === "organization_admin")?.organizationId;
      if (orgId) {
        where.seasonClubCoaches = { some: { seasonClub: { season: { league: { organizationId: orgId } } } } };
      }
    }

    const coaches = await prisma.coach.findMany({
      where,
      orderBy: { lastName: "asc" },
    });
    return success(coaches);
  } catch (error) {
    return serverError(error);
  }
}

// POST /api/coaches — create a coach record
export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuth(req, [
      "super_admin", "organization_admin", "league_admin", "club_admin",
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

    // When a Club Admin creates a coach, stamp the origin club
    const isClubAdmin = auth.roles.some((r) => r.roleName === "club_admin");
    const originClubId = isClubAdmin
      ? (auth.roles.find((r) => r.roleName === "club_admin")?.clubId ?? null)
      : null;

    const coach = await prisma.coach.create({
      data: {
        firstName,
        lastName,
        dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null,
        nationality: nationality || null,
        licenseLevel: licenseLevel || null,
        experienceYears: experienceYears || null,
        photoUrl: photoUrl || null,
        clubId: originClubId,
      },
    });

    return created(coach);
  } catch (error) {
    return serverError(error);
  }
}
