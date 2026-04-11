import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth, isAuthError } from "@/lib/auth";
import {
  success,
  created,
  badRequest,
  notFound,
  forbidden,
  serverError,
  unprocessableEntity,
  parseUUID,
} from "@/lib/api-helpers";
import { assertLeagueScope, assertOrgScope } from "@/lib/scope-guard";
import { generateFixtures } from "@/lib/fixture-generator";

// POST /api/matches/fixtures — generate fixtures for a season
// Body: { seasonId, force?: boolean }
export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuth(req, [
      "super_admin", "organization_admin", "league_admin",
    ]);
    if (isAuthError(auth)) return auth;

    const body = await req.json();
    const { seasonId: seasonIdRaw, force = false } = body;

    const seasonId = parseUUID(seasonIdRaw);
    if (!seasonId) return badRequest("seasonId is required and must be a valid UUID");

    const season = await prisma.season.findUnique({
      where: { id: seasonId },
      include: { league: true },
    });
    if (!season) return notFound("Season not found");

    // Scope check
    if (
      !assertLeagueScope(auth, season.leagueId) &&
      !assertOrgScope(auth, season.league.organizationId)
    ) {
      return forbidden();
    }

    // ── Pre-condition checks ──────────────────────────────────────────────────

    const details: Array<{ criterion: string; message: string; clubs?: string[] }> = [];

    // 1. Season must be active
    if (season.status !== "active") {
      details.push({
        criterion: "season_status",
        message: `Season must be active to generate fixtures (current: ${season.status})`,
      });
    }

    // 2. Existing fixtures guard
    if (!force) {
      const existingCount = await prisma.match.count({ where: { seasonId } });
      if (existingCount > 0) {
        details.push({
          criterion: "existing_fixtures",
          message: `${existingCount} fixture(s) already exist. Pass force: true to regenerate.`,
        });
      }
    }

    // 3. Per-club readiness: ≥3 active players + ≥1 active coach
    const seasonClubs = await prisma.seasonClub.findMany({
      where: { seasonId },
      include: {
        club: { select: { id: true, name: true } },
        _count: {
          select: {
            players: { where: { status: "active" } },
            coaches: { where: { status: "active" } },
          },
        },
      },
    });

    if (seasonClubs.length < 2) {
      details.push({
        criterion: "min_clubs",
        message: "Need at least 2 clubs to generate fixtures",
      });
    }

    const clubsLowPlayers = seasonClubs.filter((sc) => sc._count.players < 3);
    if (clubsLowPlayers.length > 0) {
      details.push({
        criterion: "min_players",
        message: `${clubsLowPlayers.length} club(s) have fewer than 3 active players`,
        clubs: clubsLowPlayers.map((sc) => sc.club.name),
      });
    }

    const clubsNoCoach = seasonClubs.filter((sc) => sc._count.coaches < 1);
    if (clubsNoCoach.length > 0) {
      details.push({
        criterion: "min_coaches",
        message: `${clubsNoCoach.length} club(s) have no active coach`,
        clubs: clubsNoCoach.map((sc) => sc.club.name),
      });
    }

    // 4. Referee and MEA quota (only enforced when requiredClubs is set)
    const refereeAssignments = await prisma.seasonReferee.findMany({
      where: { seasonId },
      select: { refereeId: true },
    });

    const meaRole = await prisma.role.findUnique({ where: { name: "match_event_admin" } });
    const meaAssignments = meaRole
      ? await prisma.userRoleScope.findMany({
        where: { roleId: meaRole.id, seasonId },
        select: { userId: true },
      })
      : [];

    if (season.requiredClubs !== null) {
      const requiredReferees = 4 * season.requiredClubs;
      const requiredMEAs = season.requiredClubs;

      if (refereeAssignments.length < requiredReferees) {
        details.push({
          criterion: "referee_quota",
          message: `Need ${requiredReferees} referees (4 × ${season.requiredClubs} clubs), only ${refereeAssignments.length} assigned`,
        });
      }

      if (meaAssignments.length < requiredMEAs) {
        details.push({
          criterion: "mea_quota",
          message: `Need ${requiredMEAs} match event admins (1 × ${season.requiredClubs} clubs), only ${meaAssignments.length} assigned`,
        });
      }
    }

    if (details.length > 0) {
      return unprocessableEntity({
        code: "FIXTURE_PRECONDITION_FAILED",
        details,
      });
    }

    // ── Generate fixtures ─────────────────────────────────────────────────────

    const clubIds = seasonClubs.map((sc) => sc.club.id);
    const refereeIds = refereeAssignments.map((r) => r.refereeId);
    const meaUserIds = meaAssignments.map((m) => m.userId);
    const type = (season.roundRobinType ?? "double") as "single" | "double";
    const daysBetweenRounds = season.daysBetweenRounds ?? 7;

    // Fetch stadium info for all clubs in the season
    const clubDetails = await prisma.club.findMany({
      where: { id: { in: clubIds } },
      select: { id: true, primaryStadiumId: true },
    });
    const clubStadiumMap = new Map(
      clubDetails.map((c) => [c.id, c.primaryStadiumId ?? null])
    );

    // Standard kickoff times used globally — pick randomly per match
    const KICKOFF_SLOTS = [
      { h: 15, m: 0 },
      { h: 17, m: 0 },
      { h: 19, m: 0 },
      { h: 20, m: 0 },
      { h: 20, m: 45 },
    ];

    const generated = generateFixtures(
      clubIds,
      type,
      new Date(season.startDate),
      daysBetweenRounds,
      refereeIds,
      meaUserIds
    );

    // ── Persist — sequential, no interactive transaction (avoids timeout) ────

    // Delete existing if force
    if (force) {
      const existingMatchIds = await prisma.match.findMany({
        where: { seasonId },
        select: { id: true },
      });
      const ids = existingMatchIds.map((m) => m.id);
      if (ids.length > 0) {
        await prisma.matchReferee.deleteMany({ where: { matchId: { in: ids } } });
        await prisma.$executeRaw`DELETE FROM match_meas WHERE "matchId" = ANY(${ids}::uuid[])`;
      }
      await prisma.match.deleteMany({ where: { seasonId } });
    }

    // Prepare all match data
    const matchInserts = generated.map(({ fixture }) => {
      const stadiumId =
        clubStadiumMap.get(fixture.homeClubId) ??
        clubStadiumMap.get(fixture.awayClubId) ??
        null;
      const kickoffSlot = KICKOFF_SLOTS[Math.floor(Math.random() * KICKOFF_SLOTS.length)];
      const matchDate = new Date(fixture.matchDate);
      matchDate.setHours(kickoffSlot.h, kickoffSlot.m, 0, 0);
      return {
        seasonId,
        homeClubId: fixture.homeClubId,
        awayClubId: fixture.awayClubId,
        matchDate,
        roundNumber: fixture.roundNumber,
        stadiumId,
        status: "scheduled" as const,
      };
    });

    // Create all matches and collect IDs
    const createdMatches: Array<{ id: string }> = [];
    for (const data of matchInserts) {
      const m = await prisma.match.create({ data, select: { id: true } });
      createdMatches.push(m);
    }

    // Batch create all referee assignments
    const refereeData = generated.flatMap(({ referees }, idx) =>
      referees.map((r) => ({
        matchId: createdMatches[idx].id,
        refereeId: r.refereeId,
        role: r.role,
      }))
    );
    if (refereeData.length > 0) {
      await prisma.matchReferee.createMany({ data: refereeData });
    }

    // Insert MEA assignments via raw SQL
    for (let i = 0; i < generated.length; i++) {
      const { mea } = generated[i];
      if (mea) {
        const matchId = createdMatches[i].id;
        const userId = mea.userId;
        await prisma.$executeRaw`
          INSERT INTO match_meas (id, "matchId", "userId", "assignedAt")
          VALUES (gen_random_uuid(), ${matchId}::uuid, ${userId}::uuid, NOW())
          ON CONFLICT ("matchId", "userId") DO NOTHING
        `;
      }
    }

    return created({
      rounds: generated.length > 0
        ? Math.max(...generated.map((g) => g.fixture.roundNumber))
        : 0,
      matchesCreated: generated.length,
      type,
      matches: generated.map((g, i) => ({
        roundNumber: g.fixture.roundNumber,
        matchDate: g.fixture.matchDate.toISOString(),
        homeClubId: g.fixture.homeClubId,
        awayClubId: g.fixture.awayClubId,
        refereesAssigned: g.referees.length,
        matchId: createdMatches[i].id,
      })),
    });
  } catch (error) {
    return serverError(error);
  }
}
