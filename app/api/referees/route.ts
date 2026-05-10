import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth, isAuthError } from "@/lib/auth";
import { success, created, badRequest, serverError } from "@/lib/api-helpers";

// GET /api/referees
// - super_admin        → all referees
// - organization_admin → referees belonging to their organization
// - league_admin       → referees assigned to seasons in their league
// - club_admin / fan   → referees assigned to seasons in their club's league (read-only)
// - others             → all referees (read-only)
export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuth(req);
    if (isAuthError(auth)) return auth;

    const isSuperAdmin = auth.roles.some((r) => r.roleName === "super_admin");
    if (isSuperAdmin) {
      return success(await prisma.referee.findMany({ orderBy: { lastName: "asc" } }));
    }

    // Org admin — referees owned by their organization
    const orgAdminRole = auth.roles.find(
      (r) => r.roleName === "organization_admin" && r.organizationId
    );
    if (orgAdminRole?.organizationId) {
      const referees = await prisma.referee.findMany({
        where: { organizationId: orgAdminRole.organizationId },
        orderBy: { lastName: "asc" },
      });
      return success(referees);
    }

    // League admin — referees assigned to any season in their league
    const leagueAdminRole = auth.roles.find(
      (r) => r.roleName === "league_admin" && r.leagueId
    );
    if (leagueAdminRole?.leagueId) {
      const rows = await prisma.seasonReferee.findMany({
        where: { season: { leagueId: leagueAdminRole.leagueId } },
        select: { refereeId: true },
        distinct: ["refereeId"],
      });
      const ids = rows.map((r) => r.refereeId);
      if (ids.length === 0) return success([]);
      return success(
        await prisma.referee.findMany({
          where: { id: { in: ids } },
          orderBy: { lastName: "asc" },
        })
      );
    }

    // Club admin — referees assigned to seasons their club participates in
    const clubAdminRole = auth.roles.find(
      (r) => r.roleName === "club_admin" && r.clubId
    );
    if (clubAdminRole?.clubId) {
      const seasonClubs = await prisma.seasonClub.findMany({
        where: { clubId: clubAdminRole.clubId },
        select: { seasonId: true },
      });
      const seasonIds = seasonClubs.map((sc) => sc.seasonId);
      if (seasonIds.length === 0) return success([]);
      const rows = await prisma.seasonReferee.findMany({
        where: { seasonId: { in: seasonIds } },
        select: { refereeId: true },
        distinct: ["refereeId"],
      });
      const ids = rows.map((r) => r.refereeId);
      if (ids.length === 0) return success([]);
      return success(
        await prisma.referee.findMany({
          where: { id: { in: ids } },
          orderBy: { lastName: "asc" },
        })
      );
    }

    // All other roles — return all (read-only)
    return success(await prisma.referee.findMany({ orderBy: { lastName: "asc" } }));
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

    // Derive organizationId from the creator's scope
    const orgAdminRole = auth.roles.find(
      (r) => r.roleName === "organization_admin" && r.organizationId
    );
    const leagueAdminRole = auth.roles.find(
      (r) => r.roleName === "league_admin" && r.organizationId
    );
    const organizationId =
      orgAdminRole?.organizationId ??
      leagueAdminRole?.organizationId ??
      null;

    const referee = await prisma.referee.create({
      data: {
        firstName,
        lastName,
        dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null,
        nationality: nationality || null,
        licenseLevel: licenseLevel || null,
        experienceYears: experienceYears || null,
        photoUrl: photoUrl || null,
        organizationId,
      },
    });

    return created(referee);
  } catch (error) {
    return serverError(error);
  }
}
