import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth, isAuthError } from "@/lib/auth";
import { success, created, badRequest, serverError, parsePagination, paginated } from "@/lib/api-helpers";

// GET /api/referees
// ?page=1&limit=20&search=<name>
export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuth(req);
    if (isAuthError(auth)) return auth;

    const sp = req.nextUrl.searchParams;
    const { page, limit, skip } = parsePagination(sp);
    const search = sp.get("search")?.trim();

    const isSuperAdmin = auth.roles.some((r) => r.roleName === "super_admin");

    const nameFilter = search
      ? { OR: [{ firstName: { contains: search, mode: "insensitive" as const } }, { lastName: { contains: search, mode: "insensitive" as const } }] }
      : {};

    if (isSuperAdmin) {
      const [total, referees] = await Promise.all([
        prisma.referee.count({ where: nameFilter }),
        prisma.referee.findMany({ where: nameFilter, orderBy: { lastName: "asc" }, skip, take: limit }),
      ]);
      return paginated(referees, total, page, limit);
    }

    const orgAdminRole = auth.roles.find((r) => r.roleName === "organization_admin" && r.organizationId);
    if (orgAdminRole?.organizationId) {
      const where = { organizationId: orgAdminRole.organizationId, ...nameFilter };
      const [total, referees] = await Promise.all([
        prisma.referee.count({ where }),
        prisma.referee.findMany({ where, orderBy: { lastName: "asc" }, skip, take: limit }),
      ]);
      return paginated(referees, total, page, limit);
    }

    const leagueAdminRole = auth.roles.find((r) => r.roleName === "league_admin" && r.leagueId);
    if (leagueAdminRole?.leagueId) {
      const rows = await prisma.seasonReferee.findMany({
        where: { season: { leagueId: leagueAdminRole.leagueId } },
        select: { refereeId: true },
        distinct: ["refereeId"],
      });
      const ids = rows.map((r) => r.refereeId);
      if (ids.length === 0) return paginated([], 0, page, limit);
      const where = { id: { in: ids }, ...nameFilter };
      const [total, referees] = await Promise.all([
        prisma.referee.count({ where }),
        prisma.referee.findMany({ where, orderBy: { lastName: "asc" }, skip, take: limit }),
      ]);
      return paginated(referees, total, page, limit);
    }

    const clubAdminRole = auth.roles.find((r) => r.roleName === "club_admin" && r.clubId);
    if (clubAdminRole?.clubId) {
      const seasonClubs = await prisma.seasonClub.findMany({
        where: { clubId: clubAdminRole.clubId },
        select: { seasonId: true },
      });
      const seasonIds = seasonClubs.map((sc) => sc.seasonId);
      if (seasonIds.length === 0) return paginated([], 0, page, limit);
      const rows = await prisma.seasonReferee.findMany({
        where: { seasonId: { in: seasonIds } },
        select: { refereeId: true },
        distinct: ["refereeId"],
      });
      const ids = rows.map((r) => r.refereeId);
      if (ids.length === 0) return paginated([], 0, page, limit);
      const where = { id: { in: ids }, ...nameFilter };
      const [total, referees] = await Promise.all([
        prisma.referee.count({ where }),
        prisma.referee.findMany({ where, orderBy: { lastName: "asc" }, skip, take: limit }),
      ]);
      return paginated(referees, total, page, limit);
    }

    // All other roles
    const [total, referees] = await Promise.all([
      prisma.referee.count({ where: nameFilter }),
      prisma.referee.findMany({ where: nameFilter, orderBy: { lastName: "asc" }, skip, take: limit }),
    ]);
    return paginated(referees, total, page, limit);
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
