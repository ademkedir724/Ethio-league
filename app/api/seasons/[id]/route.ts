import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth, isAuthError, hasRole, hasOrgRole } from "@/lib/auth";
import { success, badRequest, notFound, serverError, parseId } from "@/lib/api-helpers";
import { NextResponse } from "next/server";

// GET /api/seasons/:id
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth(req);
    if (isAuthError(auth)) return auth;

    const { id: idStr } = await params;
    const id = parseId({ id: idStr });
    if (!id) return badRequest("Invalid season ID");

    const season = await prisma.season.findUnique({
      where: { id },
      include: {
        organization: { select: { id: true, name: true } },
        leagueType: true,
        seasonClubs: {
          include: { club: true },
        },
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
    const id = parseId({ id: idStr });
    if (!id) return badRequest("Invalid season ID");

    const season = await prisma.season.findUnique({ where: { id } });
    if (!season) return notFound("Season not found");

    const isSuperAdmin = hasRole(auth, ["super_admin"]);
    const isOrgAdmin = hasOrgRole(auth, "organization_admin", season.organizationId);
    if (!isSuperAdmin && !isOrgAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const data = await req.json();
    const allowedFields = [
      "name", "leagueName", "leagueTypeId", "genderCategory",
      "ageCategory", "divisionLevel", "startDate", "endDate",
      "pointsWin", "pointsDraw", "pointsLoss", "status",
    ];
    const updateData: Record<string, unknown> = {};
    for (const field of allowedFields) {
      if (data[field] !== undefined) {
        if (field === "startDate" || field === "endDate") {
          updateData[field] = new Date(data[field]);
        } else {
          updateData[field] = data[field];
        }
      }
    }

    const updated = await prisma.season.update({
      where: { id },
      data: updateData,
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
    const auth = await requireAuth(req, ["super_admin"]);
    if (isAuthError(auth)) return auth;

    const { id: idStr } = await params;
    const id = parseId({ id: idStr });
    if (!id) return badRequest("Invalid season ID");

    await prisma.season.delete({ where: { id } });
    return success({ message: "Season deleted" });
  } catch (error) {
    return serverError(error);
  }
}
