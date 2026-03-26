import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth, isAuthError } from "@/lib/auth";
import { success, created, badRequest, serverError } from "@/lib/api-helpers";

// GET /api/players — list players (scope-filtered by role)
export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuth(req);
    if (isAuthError(auth)) return auth;

    const where: Record<string, unknown> = {};

    const isClubAdmin = auth.roles.some((r) => r.roleName === "club_admin");
    const isOrgAdmin = auth.roles.some((r) => r.roleName === "organization_admin");

    if (isClubAdmin) {
      const clubId = auth.roles.find((r) => r.roleName === "club_admin")?.clubId;
      if (clubId) {
        where.seasonClubPlayers = { some: { seasonClub: { clubId } } };
      }
    } else if (isOrgAdmin) {
      const orgId = auth.roles.find((r) => r.roleName === "organization_admin")?.organizationId;
      if (orgId) {
        where.seasonClubPlayers = { some: { seasonClub: { season: { organizationId: orgId } } } };
      }
    }

    const players = await prisma.player.findMany({
      where,
      include: {
        primaryPosition: { select: { id: true, code: true, name: true } },
      },
      orderBy: { lastName: "asc" },
    });
    return success(players);
  } catch (error) {
    return serverError(error);
  }
}

// POST /api/players — create a new player (permanent record)
export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuth(req, [
      "super_admin", "organization_admin", "league_admin", "club_admin",
    ]);
    if (isAuthError(auth)) return auth;

    const body = await req.json();
    const {
      firstName, lastName, dateOfBirth, nationality,
      heightCm, weightKg, preferredFoot, primaryPositionId, photoUrl,
    } = body;

    if (!firstName || !lastName) {
      return badRequest("firstName and lastName are required");
    }

    const player = await prisma.player.create({
      data: {
        firstName,
        lastName,
        dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null,
        nationality: nationality || null,
        heightCm: heightCm || null,
        weightKg: weightKg || null,
        preferredFoot: preferredFoot || null,
        primaryPositionId: primaryPositionId || null,
        photoUrl: photoUrl || null,
      },
      include: { primaryPosition: true },
    });

    return created(player);
  } catch (error) {
    return serverError(error);
  }
}
