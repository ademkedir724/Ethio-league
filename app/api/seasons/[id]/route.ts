import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth, isAuthError } from "@/lib/auth";
import { success, badRequest, notFound, forbidden, serverError, parseUUID, unprocessableEntity } from "@/lib/api-helpers";
import { assertLeagueScope, assertOrgScope } from "@/lib/scope-guard";
import { logAudit } from "@/lib/audit";

export interface ValidationDetail {
  criterion: "required_clubs" | "min_players" | "min_coaches";
  message: string;
  clubs: string[];
}

export interface SeasonClubReadiness {
  clubName: string;
  activePlayers: number;
  activeCoaches: number;
}

export interface ActivationValidationError {
  error: string;
  details: ValidationDetail[];
}

export function validateActivation(
  requiredClubs: number | null,
  totalClubs: number,
  clubs: SeasonClubReadiness[]
): ValidationDetail[] {
  const details: ValidationDetail[] = [];

  // Check 1: required clubs count
  if (requiredClubs !== null && totalClubs < requiredClubs) {
    details.push({
      criterion: "required_clubs",
      message: `Season requires ${requiredClubs} clubs but only ${totalClubs} are assigned`,
      clubs: [],
    });
  }

  // Check 2: min 3 active players per club
  const lowPlayers = clubs.filter((c) => c.activePlayers < 3);
  if (lowPlayers.length > 0) {
    details.push({
      criterion: "min_players",
      message: `${lowPlayers.length} club(s) have fewer than 3 active players`,
      clubs: lowPlayers.map((c) => c.clubName),
    });
  }

  // Check 3: min 1 active coach per club
  const noCoach = clubs.filter((c) => c.activeCoaches < 1);
  if (noCoach.length > 0) {
    details.push({
      criterion: "min_coaches",
      message: `${noCoach.length} club(s) have no active coach`,
      clubs: noCoach.map((c) => c.clubName),
    });
  }

  return details;
}

// GET /api/seasons/:id
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth(req);
    if (isAuthError(auth)) return auth;

    const { id: idStr } = await params;
    const id = parseUUID(idStr);
    if (!id) return badRequest("Invalid season ID");

    const season = await prisma.season.findUnique({
      where: { id },
      include: {
        league: {
          include: { organization: { select: { id: true, name: true } } },
        },
        seasonClubs: { include: { club: true } },
        _count: { select: { matches: true } },
      },
    });

    if (!season) return notFound("Season not found");
    return success(season);
  } catch (error) {
    return serverError(error);
  }
}

// PATCH /api/seasons/:id
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth(req);
    if (isAuthError(auth)) return auth;

    const { id: idStr } = await params;
    const id = parseUUID(idStr);
    if (!id) return badRequest("Invalid season ID");

    const season = await prisma.season.findUnique({
      where: { id },
      include: { league: true },
    });
    if (!season) return notFound("Season not found");

    if (!assertLeagueScope(auth, season.leagueId) && !assertOrgScope(auth, season.league.organizationId)) {
      return forbidden();
    }

    const data = await req.json();
    const allowedFields = ["name", "startDate", "endDate", "pointsWin", "pointsDraw", "pointsLoss", "status",
      "requiredClubs", "roundRobinType", "daysBetweenRounds"];
    const updateData: Record<string, unknown> = {};
    for (const field of allowedFields) {
      if (data[field] !== undefined) {
        updateData[field] = (field === "startDate" || field === "endDate")
          ? new Date(data[field])
          : data[field];
      }
    }

    // Activation readiness validation
    if (data.status === "active") {
      const seasonClubs = await prisma.seasonClub.findMany({
        where: { seasonId: id },
        include: {
          club: { select: { name: true } },
          _count: {
            select: {
              players: { where: { status: "active" } },
              coaches: { where: { status: "active" } },
            },
          },
        },
      });

      const clubReadiness: SeasonClubReadiness[] = seasonClubs.map((sc) => ({
        clubName: sc.club.name,
        activePlayers: sc._count.players,
        activeCoaches: sc._count.coaches,
      }));

      const details = validateActivation(
        season.requiredClubs,
        seasonClubs.length,
        clubReadiness
      );

      if (details.length > 0) {
        return unprocessableEntity({ code: "ACTIVATION_VALIDATION_FAILED", details });
      }
    }

    const updated = await prisma.season.update({ where: { id }, data: updateData });

    await logAudit({
      userId: auth.userId,
      actionType: "season_updated",
      targetId: id,
      targetType: "season",
      description: `Season "${updated.name}" updated`,
    });

    return success(updated);
  } catch (error) {
    return serverError(error);
  }
}

// DELETE /api/seasons/:id
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth(req, ["super_admin", "organization_admin"]);
    if (isAuthError(auth)) return auth;

    const { id: idStr } = await params;
    const id = parseUUID(idStr);
    if (!id) return badRequest("Invalid season ID");

    const season = await prisma.season.findUnique({
      where: { id },
      include: { league: true },
    });
    if (!season) return notFound("Season not found");

    if (!assertOrgScope(auth, season.league.organizationId)) return forbidden();

    await prisma.season.delete({ where: { id } });

    await logAudit({
      userId: auth.userId,
      actionType: "season_deleted",
      targetId: id,
      targetType: "season",
      description: `Season "${season.name}" deleted`,
    });

    return success({ message: "Season deleted" });
  } catch (error) {
    return serverError(error);
  }
}
