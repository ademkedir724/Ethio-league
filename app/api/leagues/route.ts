import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth, isAuthError } from "@/lib/auth";
import { success, created, badRequest, serverError } from "@/lib/api-helpers";
import { assertOrgScope } from "@/lib/scope-guard";
import { logAudit } from "@/lib/audit";

// GET /api/leagues — list leagues scoped by role
export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuth(req);
    if (isAuthError(auth)) return auth;

    const isSuperAdmin = auth.roles.some((r) => r.roleName === "super_admin");
    const orgAdminRole = auth.roles.find((r) => r.roleName === "organization_admin");
    const leagueAdminRole = auth.roles.find((r) => r.roleName === "league_admin");

    let where: Record<string, unknown> = {};

    if (isSuperAdmin) {
      // no filter — return all
    } else if (orgAdminRole?.organizationId) {
      where = { organizationId: orgAdminRole.organizationId };
    } else if (leagueAdminRole?.leagueId) {
      where = { id: leagueAdminRole.leagueId };
    } else {
      where = { id: "none" }; // no access
    }

    const leagues = await prisma.league.findMany({
      where,
      include: {
        organization: { select: { id: true, name: true } },
        leagueType: { select: { id: true, name: true } },
        _count: { select: { seasons: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return success(leagues);
  } catch (error) {
    return serverError(error);
  }
}

// POST /api/leagues — create a league (org_admin or super_admin)
export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuth(req, ["super_admin", "organization_admin"]);
    if (isAuthError(auth)) return auth;

    const body = await req.json();
    const { organizationId, name, leagueTypeId, genderCategory, ageCategory, divisionLevel, logoUrl, description } = body;

    if (!organizationId) return badRequest("organizationId is required");
    if (!name) return badRequest("name is required");

    if (!assertOrgScope(auth, organizationId)) {
      return badRequest("You do not have permission to create leagues for this organization");
    }

    const league = await prisma.league.create({
      data: {
        organizationId,
        name,
        leagueTypeId: leagueTypeId || null,
        genderCategory: genderCategory || null,
        ageCategory: ageCategory || null,
        divisionLevel: divisionLevel || null,
        logoUrl: logoUrl || null,
        description: description || null,
      },
      include: {
        organization: { select: { id: true, name: true } },
        leagueType: { select: { id: true, name: true } },
      },
    });

    await logAudit({
      userId: auth.userId,
      actionType: "league_created",
      targetId: league.id,
      targetType: "league",
      description: `League "${league.name}" created`,
    });

    return created(league);
  } catch (error) {
    return serverError(error);
  }
}
