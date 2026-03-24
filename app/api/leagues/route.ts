import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth, isAuthError, hasRole, hasOrgRole, hashPassword } from "@/lib/auth";
import { success, created, badRequest, serverError } from "@/lib/api-helpers";
import { randomBytes } from "crypto";

// GET /api/leagues?organizationId=X — list leagues (grouped seasons by leagueName)
export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuth(req);
    if (isAuthError(auth)) return auth;

    const orgId = req.nextUrl.searchParams.get("organizationId");

    // For org_admin, they can only see their own organization's leagues
    const isSuperAdmin = hasRole(auth, ["super_admin"]);
    
    let whereClause = {};
    if (orgId) {
      whereClause = { organizationId: orgId };
    }

    // Get all seasons and group them by leagueName to form "leagues"
    const seasons = await prisma.season.findMany({
      where: whereClause,
      include: {
        organization: { select: { id: true, name: true } },
        leagueType: true,
        _count: { select: { seasonClubs: true, matches: true } },
      },
      orderBy: [{ leagueName: "asc" }, { startDate: "desc" }],
    });

    // Group seasons by leagueName + organizationId to create "leagues"
    const leagueMap = new Map<string, {
      id: string;
      name: string;
      organizationId: string;
      organizationName: string;
      genderCategory: string | null;
      ageCategory: string | null;
      type: string | null;
      status: string;
      seasonCount: number;
      activeSeasonCount: number;
      totalClubs: number;
      totalMatches: number;
      seasons: typeof seasons;
    }>();

    for (const season of seasons) {
      const key = `${season.organizationId}-${season.leagueName}`;
      
      if (!leagueMap.has(key)) {
        leagueMap.set(key, {
          id: key,
          name: season.leagueName,
          organizationId: season.organizationId,
          organizationName: season.organization.name,
          genderCategory: season.genderCategory,
          ageCategory: season.ageCategory,
          type: season.leagueType?.name || null,
          status: "active",
          seasonCount: 0,
          activeSeasonCount: 0,
          totalClubs: 0,
          totalMatches: 0,
          seasons: [],
        });
      }

      const league = leagueMap.get(key)!;
      league.seasonCount += 1;
      if (season.status === "active") {
        league.activeSeasonCount += 1;
      }
      league.totalClubs += season._count.seasonClubs;
      league.totalMatches += season._count.matches;
      league.seasons.push(season);
    }

    const leagues = Array.from(leagueMap.values());

    return success(leagues);
  } catch (error) {
    return serverError(error);
  }
}

// POST /api/leagues — create a new league with first season + league admin
export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuth(req);
    if (isAuthError(auth)) return auth;

    const body = await req.json();
    const {
      // League/Season data
      organizationId,
      leagueName,
      leagueTypeId,
      genderCategory,
      ageCategory,
      divisionLevel,
      description,
      // First season data
      seasonName,
      startDate,
      endDate,
      // League Admin data
      adminFullName,
      adminEmail,
      adminPhone,
    } = body;

    if (!organizationId || !leagueName || !seasonName || !startDate || !endDate) {
      return badRequest(
        "organizationId, leagueName, seasonName, startDate, and endDate are required"
      );
    }

    if (!adminFullName || !adminEmail) {
      return badRequest("League Admin details (adminFullName, adminEmail) are required");
    }

    // Auth check: super_admin or org admin of the org
    const isSuperAdmin = hasRole(auth, ["super_admin"]);
    const isOrgAdmin = hasOrgRole(auth, "organization_admin", organizationId);
    if (!isSuperAdmin && !isOrgAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Check if admin email already exists
    const existingUser = await prisma.user.findUnique({ where: { email: adminEmail } });
    if (existingUser) {
      return badRequest("A user with this email already exists");
    }

    // Generate password reset token for the new admin
    const passwordResetToken = randomBytes(32).toString("hex");
    const passwordResetExpires = new Date(Date.now() + 3600000); // 1 hour

    // Create everything in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // 1. Create the season (which represents the league)
      const season = await tx.season.create({
        data: {
          organizationId,
          name: seasonName,
          leagueName,
          leagueTypeId: leagueTypeId || null,
          genderCategory: genderCategory || null,
          ageCategory: ageCategory || null,
          divisionLevel: divisionLevel || null,
          startDate: new Date(startDate),
          endDate: new Date(endDate),
        },
      });

      // 2. Create the league admin user
      const leagueAdmin = await tx.user.create({
        data: {
          email: adminEmail,
          fullName: adminFullName,
          phone: adminPhone || null,
          passwordHash: await hashPassword(randomBytes(16).toString("hex")), // Temporary password
          passwordResetToken,
          passwordResetExpires,
          status: "pending",
        },
      });

      // 3. Get the league_admin role
      const leagueAdminRole = await tx.role.findUnique({
        where: { name: "league_admin" },
      });

      if (!leagueAdminRole) {
        throw new Error("league_admin role not found");
      }

      // 4. Assign the role to the user with organization and season scope
      await tx.userRoleScope.create({
        data: {
          userId: leagueAdmin.id,
          roleId: leagueAdminRole.id,
          organizationId,
          seasonId: season.id,
        },
      });

      return {
        season,
        leagueAdmin: {
          id: leagueAdmin.id,
          email: leagueAdmin.email,
          fullName: leagueAdmin.fullName,
        },
        passwordSetupLink: `/set-password?token=${passwordResetToken}`,
      };
    });

    return created(result);
  } catch (error) {
    return serverError(error);
  }
}
