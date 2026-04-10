import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth, isAuthError } from "@/lib/auth";
import { success, created, badRequest, serverError } from "@/lib/api-helpers";

// GET /api/players — list players (scope-filtered by role)
// ?search=<name>  — name filter
// ?scope=system   — bypass role scope, search all players system-wide (any role)
// ?scope=club     — explicit club pool (default for club_admin)
export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuth(req);
    if (isAuthError(auth)) return auth;

    const searchQuery = req.nextUrl.searchParams.get("search")?.trim();
    const scopeParam = req.nextUrl.searchParams.get("scope");

    const where: Record<string, unknown> = {};

    const isClubAdmin = auth.roles.some((r) => r.roleName === "club_admin");
    const isOrgAdmin = auth.roles.some((r) => r.roleName === "organization_admin");
    const isLeagueAdmin = auth.roles.some((r) => r.roleName === "league_admin");

    // scope=system bypasses all role filters — any role can search system-wide
    const isSystemSearch =
      scopeParam === "system" ||
      (isClubAdmin && searchQuery && scopeParam !== "club");

    if (isSystemSearch) {
      // System-wide search — no scope filter, just name match
      if (searchQuery) {
        where.OR = [
          { firstName: { contains: searchQuery, mode: "insensitive" } },
          { lastName: { contains: searchQuery, mode: "insensitive" } },
        ];
      }
      // If no search query with scope=system, return all (super_admin use case)
    } else if (isClubAdmin) {
      const clubId = auth.roles.find((r) => r.roleName === "club_admin")?.clubId;
      if (clubId) {
        where.clubId = clubId;
        if (searchQuery) {
          where.OR = [
            { firstName: { contains: searchQuery, mode: "insensitive" } },
            { lastName: { contains: searchQuery, mode: "insensitive" } },
          ];
        }
      }
    } else if (isLeagueAdmin) {
      const leagueId = auth.roles.find((r) => r.roleName === "league_admin")?.leagueId;
      if (leagueId) {
        if (searchQuery) {
          where.AND = [
            { seasonClubPlayers: { some: { seasonClub: { season: { leagueId } } } } },
            {
              OR: [
                { firstName: { contains: searchQuery, mode: "insensitive" } },
                { lastName: { contains: searchQuery, mode: "insensitive" } },
              ],
            },
          ];
        } else {
          where.seasonClubPlayers = { some: { seasonClub: { season: { leagueId } } } };
        }
      }
    } else if (isOrgAdmin) {
      const orgId = auth.roles.find((r) => r.roleName === "organization_admin")?.organizationId;
      if (orgId) {
        where.seasonClubPlayers = { some: { seasonClub: { season: { league: { organizationId: orgId } } } } };
      }
    }

    const players = await prisma.player.findMany({
      where,
      include: {
        primaryPosition: { select: { id: true, code: true, name: true } },
        originClub: { select: { id: true, name: true } },
      },
      orderBy: { lastName: "asc" },
      take: isSystemSearch ? 50 : undefined,
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

    // When a Club Admin creates a player, stamp the origin club
    const isClubAdmin = auth.roles.some((r) => r.roleName === "club_admin");
    const originClubId = isClubAdmin
      ? (auth.roles.find((r) => r.roleName === "club_admin")?.clubId ?? null)
      : null;

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
        clubId: originClubId,
      },
      include: { primaryPosition: true },
    });

    return created(player);
  } catch (error) {
    return serverError(error);
  }
}
