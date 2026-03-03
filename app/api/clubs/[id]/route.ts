import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth, isAuthError, hasRole, hasClubRole } from "@/lib/auth";
import { success, badRequest, notFound, serverError, parseId } from "@/lib/api-helpers";
import { NextResponse } from "next/server";

// GET /api/clubs/:id
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth(req);
    if (isAuthError(auth)) return auth;

    const { id: idStr } = await params;
    const id = parseId({ id: idStr });
    if (!id) return badRequest("Invalid club ID");

    const club = await prisma.club.findUnique({
      where: { id },
      include: {
        primaryStadium: true,
        ownedStadiums: true,
        seasonClubs: {
          include: {
            season: { select: { id: true, name: true, leagueName: true } },
          },
        },
      },
    });

    if (!club) return notFound("Club not found");
    return success(club);
  } catch (error) {
    return serverError(error);
  }
}

// PATCH /api/clubs/:id
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth(req);
    if (isAuthError(auth)) return auth;

    const { id: idStr } = await params;
    const id = parseId({ id: idStr });
    if (!id) return badRequest("Invalid club ID");

    const isSuperAdmin = hasRole(auth, ["super_admin"]);
    const isClubAdmin = hasClubRole(auth, "club_admin", id);
    const isOrgAdmin = hasRole(auth, ["organization_admin"]);

    if (!isSuperAdmin && !isClubAdmin && !isOrgAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const data = await req.json();
    const allowedFields = [
      "name", "shortName", "country", "city", "foundedYear",
      "logoUrl", "primaryStadiumId", "website", "description", "status",
    ];
    const updateData: Record<string, unknown> = {};
    for (const field of allowedFields) {
      if (data[field] !== undefined) updateData[field] = data[field];
    }

    const club = await prisma.club.update({
      where: { id },
      data: updateData,
    });

    return success(club);
  } catch (error) {
    return serverError(error);
  }
}

// DELETE /api/clubs/:id
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth(req, ["super_admin"]);
    if (isAuthError(auth)) return auth;

    const { id: idStr } = await params;
    const id = parseId({ id: idStr });
    if (!id) return badRequest("Invalid club ID");

    await prisma.club.delete({ where: { id } });
    return success({ message: "Club deleted" });
  } catch (error) {
    return serverError(error);
  }
}
