import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth, isAuthError } from "@/lib/auth";
import { success, created, badRequest, serverError, parsePagination, paginated } from "@/lib/api-helpers";

// GET /api/coaches — list coaches, scoped by role
export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuth(req);
    if (isAuthError(auth)) return auth;

    const sp = req.nextUrl.searchParams;
    const { page, limit, skip } = parsePagination(sp);
    const search = sp.get("search")?.trim();

    const isClubAdmin = auth.roles.some((r) => r.roleName === "club_admin");
    const isOrgAdmin = auth.roles.some((r) => r.roleName === "organization_admin");
    const isLeagueAdmin = auth.roles.some((r) => r.roleName === "league_admin");

    // ── Club Admin: query Coach table — own coaches + any assigned to their club ──
    if (isClubAdmin) {
      const clubId = auth.roles.find((r) => r.roleName === "club_admin")?.clubId;

      const baseWhere = clubId
        ? {
          OR: [
            { clubId },
            { seasonClubCoaches: { some: { seasonClub: { clubId } } } },
          ],
        }
        : {};

      const where: Record<string, unknown> = { ...baseWhere };
      if (search) {
        where.AND = [
          baseWhere,
          {
            OR: [
              { firstName: { contains: search, mode: "insensitive" } },
              { lastName: { contains: search, mode: "insensitive" } },
            ],
          },
        ];
        delete where.OR;
        delete where.clubId;
      }

      const [total, coaches] = await Promise.all([
        prisma.coach.count({ where }),
        prisma.coach.findMany({
          where,
          orderBy: { lastName: "asc" },
          skip,
          take: limit,
          include: {
            originClub: { select: { id: true, name: true } },
            seasonClubCoaches: {
              where: { seasonClub: { season: { status: "active" } } },
              select: {
                role: true,
                seasonClub: {
                  select: {
                    club: { select: { id: true, name: true } },
                    season: { select: { id: true, name: true, status: true } },
                  },
                },
              },
              take: 1,
              orderBy: { createdAt: "desc" },
            },
          },
        }),
      ]);

      const result = coaches.map((c) => {
        const active = c.seasonClubCoaches[0];
        return {
          ...c,
          currentClub: active?.seasonClub.club.name ?? c.originClub?.name ?? null,
          currentClubId: active?.seasonClub.club.id ?? c.originClub?.id ?? null,
          coachingRole: active?.role ?? null,
          seasonName: active?.seasonClub.season.name ?? null,
          seasonStatus: active?.seasonClub.season.status ?? null,
        };
      });
      return paginated(result, total, page, limit);
    }

    // ── Org Admin / League Admin / Super Admin: query SeasonClubCoach ──
    const sccWhere: Record<string, unknown> = {};

    if (isLeagueAdmin) {
      const leagueId = auth.roles.find((r) => r.roleName === "league_admin")?.leagueId;
      if (leagueId) sccWhere.seasonClub = { season: { leagueId } };
    } else if (isOrgAdmin) {
      const orgId = auth.roles.find((r) => r.roleName === "organization_admin")?.organizationId;
      if (orgId) sccWhere.seasonClub = { season: { league: { organizationId: orgId } } };
    }
    // super_admin: no filter

    if (search) {
      sccWhere.coach = {
        OR: [
          { firstName: { contains: search, mode: "insensitive" } },
          { lastName: { contains: search, mode: "insensitive" } },
        ],
      };
    }

    // For paginating deduplicated results we fetch all then slice
    // (dedup by coachId is done in-memory; count is approximate)
    const assignments = await prisma.seasonClubCoach.findMany({
      where: sccWhere,
      include: {
        coach: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            dateOfBirth: true,
            nationality: true,
            licenseLevel: true,
            experienceYears: true,
            status: true,
            clubId: true,
          },
        },
        seasonClub: {
          include: {
            club: { select: { id: true, name: true } },
            season: { select: { id: true, name: true, status: true } },
          },
        },
      },
      orderBy: { coach: { lastName: "asc" } },
    });

    // Deduplicate per coach — prefer active season assignment
    const seen = new Map<string, typeof assignments[0]>();
    for (const a of assignments) {
      const existing = seen.get(a.coachId);
      if (!existing) {
        seen.set(a.coachId, a);
      } else {
        const currentActive = a.seasonClub.season.status === "active";
        const existingActive = existing.seasonClub.season.status === "active";
        if (currentActive && !existingActive) seen.set(a.coachId, a);
      }
    }

    const allResults = Array.from(seen.values()).map((a) => ({
      ...a.coach,
      currentClub: a.seasonClub.club.name,
      currentClubId: a.seasonClub.club.id,
      coachingRole: a.role,
      seasonName: a.seasonClub.season.name,
      seasonStatus: a.seasonClub.season.status,
    }));

    const total = allResults.length;
    const result = allResults.slice(skip, skip + limit);

    return paginated(result, total, page, limit);
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
