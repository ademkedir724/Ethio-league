import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth, isAuthError } from "@/lib/auth";
import { success, created, badRequest, notFound, forbidden, serverError, parseUUID } from "@/lib/api-helpers";
import { assertClubScope } from "@/lib/scope-guard";
import { logAudit } from "@/lib/audit";

// GET /api/matches/:id/lineups — get lineups for a match
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth(req);
    if (isAuthError(auth)) return auth;

    const { id: idStr } = await params;
    const matchId = parseUUID(idStr);
    if (!matchId) return badRequest("Invalid match ID");

    const lineups = await prisma.matchLineup.findMany({
      where: { matchId },
      include: {
        seasonClubPlayer: {
          include: {
            player: { select: { id: true, firstName: true, lastName: true } },
            seasonClub: {
              include: { club: { select: { id: true, name: true } } },
            },
          },
        },
        position: true,
      },
      orderBy: [{ lineupType: "asc" }, { shirtNumber: "asc" }],
    });

    return success(lineups);
  } catch (error) {
    return serverError(error);
  }
}

// POST /api/matches/:id/lineups — submit lineup entries (fully validated)
// Body: { clubId?: string, lineups: [{ seasonClubPlayerId, positionId?, lineupType?, shirtNumber?, isCaptain? }] }
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth(req, ["super_admin", "league_admin", "club_admin"]);
    if (isAuthError(auth)) return auth;

    const { id: idStr } = await params;
    const matchId = parseUUID(idStr);
    if (!matchId) return badRequest("Invalid match ID");

    const match = await prisma.match.findUnique({ where: { id: matchId } });
    if (!match) return notFound("Match not found");

    const body = await req.json();
    const { lineups } = body;

    // Determine clubId based on caller's role
    let clubId: string | null = null;
    const isClubAdmin = auth.roles.some((r) => r.roleName === "club_admin");

    if (isClubAdmin) {
      clubId = auth.roles.find((r) => r.roleName === "club_admin")?.clubId ?? null;
    } else {
      // league_admin or super_admin: get clubId from request body
      clubId = body.clubId ?? null;
    }

    if (!clubId) return badRequest("clubId is required");

    // Scope check: super_admin and league_admin bypass club scope; club_admin must match
    const isPrivileged = auth.roles.some(
      (r) => r.roleName === "super_admin" || r.roleName === "league_admin"
    );
    if (!isPrivileged && !assertClubScope(auth, clubId)) return forbidden();

    // Validate club is a participant in this match
    if (match.homeClubId !== clubId && match.awayClubId !== clubId) {
      return badRequest("Your club is not a participant in this match");
    }

    // Validate lineups array
    if (!Array.isArray(lineups) || lineups.length === 0) {
      return badRequest("lineups array is required");
    }

    const errors: string[] = [];

    // Count starters — must be exactly 11
    const starters = lineups.filter((l) => l.lineupType === "starting");
    if (starters.length !== 11) {
      errors.push(`Lineup must have exactly 11 starters, got ${starters.length}`);
    }

    // Count captains — must be exactly 1
    const captains = lineups.filter((l) => l.isCaptain === true);
    if (captains.length !== 1) {
      errors.push(`Lineup must have exactly 1 captain, got ${captains.length}`);
    }

    // Check no player appears in both starters and substitutes
    const starterIds = new Set(starters.map((l) => l.seasonClubPlayerId));
    const substitutes = lineups.filter((l) => l.lineupType === "substitute");
    const subIds = substitutes.map((l) => l.seasonClubPlayerId);
    const overlap = subIds.filter((id) => starterIds.has(id));
    if (overlap.length > 0) {
      errors.push("A player cannot appear in both starters and substitutes");
    }

    // Validate all seasonClubPlayerIds belong to this club's SeasonClub for the match's season
    const seasonClub = await prisma.seasonClub.findUnique({
      where: { seasonId_clubId: { seasonId: match.seasonId, clubId } },
    });

    if (!seasonClub) {
      errors.push("Club is not registered in this season");
    } else {
      const validSCPs = await prisma.seasonClubPlayer.findMany({
        where: { seasonClubId: seasonClub.id },
      });
      const validIds = new Set(validSCPs.map((p) => p.id));
      const submittedIds = lineups.map((l) => l.seasonClubPlayerId);
      const invalidIds = submittedIds.filter((id) => !validIds.has(id));
      if (invalidIds.length > 0) {
        errors.push(`Some players do not belong to this club's season squad: ${invalidIds.join(", ")}`);
      }
    }

    if (errors.length > 0) {
      return NextResponse.json(
        { error: "Lineup validation failed", details: errors },
        { status: 400 }
      );
    }

    // Upsert lineup records
    const createdLineups = [];
    for (const entry of lineups) {
      const lineup = await prisma.matchLineup.upsert({
        where: {
          matchId_seasonClubPlayerId: {
            matchId,
            seasonClubPlayerId: entry.seasonClubPlayerId,
          },
        },
        create: {
          matchId,
          seasonClubPlayerId: entry.seasonClubPlayerId,
          positionId: entry.positionId || null,
          lineupType: entry.lineupType || "starting",
          shirtNumber: entry.shirtNumber || null,
          isCaptain: entry.isCaptain || false,
        },
        update: {
          positionId: entry.positionId ?? undefined,
          lineupType: entry.lineupType ?? undefined,
          shirtNumber: entry.shirtNumber ?? undefined,
          isCaptain: entry.isCaptain ?? undefined,
        },
      });
      createdLineups.push(lineup);
    }

    // Notify league admin for this season
    const leagueAdminScope = await prisma.userRoleScope.findFirst({
      where: {
        seasonId: match.seasonId,
        role: { name: "league_admin" },
      },
      include: { role: true },
    });

    if (leagueAdminScope) {
      await prisma.notification.create({
        data: {
          userId: leagueAdminScope.userId,
          title: "Lineup Submitted",
          body: `A lineup has been submitted for match ${matchId} by club ${clubId}`,
        },
      });
    }

    // Audit log
    await logAudit({
      userId: auth.userId,
      actionType: "lineup_submitted",
      targetId: matchId,
      targetType: "match",
      description: `Lineup submitted for club ${clubId} in match ${matchId}`,
    });

    return created(createdLineups);
  } catch (error) {
    return serverError(error);
  }
}
