import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth, isAuthError } from "@/lib/auth";
import { success, badRequest, notFound, forbidden, serverError, parseUUID } from "@/lib/api-helpers";
import { assertOrgScope, assertLeagueScope } from "@/lib/scope-guard";
import { logAudit } from "@/lib/audit";

// GET /api/leagues/[id]
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth(req);
    if (isAuthError(auth)) return auth;

    const { id } = await params;
    const leagueId = parseUUID(id);
    if (!leagueId) return badRequest("Invalid league ID");

    const league = await prisma.league.findUnique({
      where: { id: leagueId },
      include: {
        organization: { select: { id: true, name: true } },
        leagueType: { select: { id: true, name: true } },
        _count: { select: { seasons: true } },
      },
    });
    if (!league) return notFound("League not found");

    if (!assertLeagueScope(auth, leagueId) && !assertOrgScope(auth, league.organizationId)) {
      return forbidden();
    }

    return success(league);
  } catch (error) {
    return serverError(error);
  }
}

// PATCH /api/leagues/[id]
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth(req, ["super_admin", "organization_admin"]);
    if (isAuthError(auth)) return auth;

    const { id } = await params;
    const leagueId = parseUUID(id);
    if (!leagueId) return badRequest("Invalid league ID");

    const league = await prisma.league.findUnique({ where: { id: leagueId } });
    if (!league) return notFound("League not found");

    if (!assertOrgScope(auth, league.organizationId)) return forbidden();

    const body = await req.json();
    const { name, leagueTypeId, genderCategory, ageCategory, divisionLevel, logoUrl, description, status } = body;

    const updated = await prisma.league.update({
      where: { id: leagueId },
      data: {
        ...(name !== undefined && { name }),
        ...(leagueTypeId !== undefined && { leagueTypeId }),
        ...(genderCategory !== undefined && { genderCategory }),
        ...(ageCategory !== undefined && { ageCategory }),
        ...(divisionLevel !== undefined && { divisionLevel }),
        ...(logoUrl !== undefined && { logoUrl }),
        ...(description !== undefined && { description }),
        ...(status !== undefined && { status }),
      },
    });

    await logAudit({
      userId: auth.userId,
      actionType: "league_updated",
      targetId: leagueId,
      targetType: "league",
      description: `League "${updated.name}" updated`,
    });

    return success(updated);
  } catch (error) {
    return serverError(error);
  }
}

// DELETE /api/leagues/[id]
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth(req, ["super_admin", "organization_admin"]);
    if (isAuthError(auth)) return auth;

    const { id } = await params;
    const leagueId = parseUUID(id);
    if (!leagueId) return badRequest("Invalid league ID");

    const league = await prisma.league.findUnique({
      where: { id: leagueId },
      include: { _count: { select: { seasons: true } } },
    });
    if (!league) return notFound("League not found");

    if (!assertOrgScope(auth, league.organizationId)) return forbidden();

    if (league._count.seasons > 0) {
      return badRequest("Cannot delete a league that has seasons. Remove all seasons first.");
    }

    await prisma.league.delete({ where: { id: leagueId } });

    await logAudit({
      userId: auth.userId,
      actionType: "league_deleted",
      targetId: leagueId,
      targetType: "league",
      description: `League "${league.name}" deleted`,
    });

    return success({ message: "League deleted" });
  } catch (error) {
    return serverError(error);
  }
}
