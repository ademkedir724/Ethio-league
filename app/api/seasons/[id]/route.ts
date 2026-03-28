import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth, isAuthError } from "@/lib/auth";
import { success, badRequest, notFound, forbidden, serverError, parseUUID } from "@/lib/api-helpers";
import { assertLeagueScope, assertOrgScope } from "@/lib/scope-guard";
import { logAudit } from "@/lib/audit";

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
