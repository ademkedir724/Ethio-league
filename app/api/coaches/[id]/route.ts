import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth, isAuthError } from "@/lib/auth";
import { success, badRequest, notFound, serverError, parseUUID } from "@/lib/api-helpers";

// GET /api/coaches/:id
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth(req);
    if (isAuthError(auth)) return auth;

    const { id: idStr } = await params;
    const id = parseUUID(idStr);
    if (!id) return badRequest("Invalid coach ID");

    const coach = await prisma.coach.findUnique({
      where: { id },
      include: {
        originClub: { select: { id: true, name: true } },
        seasonClubCoaches: {
          include: {
            seasonClub: {
              include: {
                season: { select: { id: true, name: true, status: true, leagueId: true } },
                club: { select: { id: true, name: true } },
              },
            },
          },
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!coach) return notFound("Coach not found");
    return success(coach);
  } catch (error) {
    return serverError(error);
  }
}

// PATCH /api/coaches/:id
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth(req, [
      "super_admin", "organization_admin", "league_admin", "club_admin",
    ]);
    if (isAuthError(auth)) return auth;

    const { id: idStr } = await params;
    const id = parseUUID(idStr);
    if (!id) return badRequest("Invalid coach ID");

    const data = await req.json();
    const allowedFields = [
      "firstName", "lastName", "dateOfBirth", "nationality",
      "licenseLevel", "experienceYears", "photoUrl", "status",
    ];
    const updateData: Record<string, unknown> = {};
    for (const field of allowedFields) {
      if (data[field] !== undefined) {
        if (field === "dateOfBirth") {
          updateData[field] = new Date(data[field]);
        } else {
          updateData[field] = data[field];
        }
      }
    }

    const coach = await prisma.coach.update({
      where: { id },
      data: updateData,
    });

    return success(coach);
  } catch (error) {
    return serverError(error);
  }
}

// DELETE /api/coaches/:id
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth(req, ["super_admin"]);
    if (isAuthError(auth)) return auth;

    const { id: idStr } = await params;
    const id = parseUUID(idStr);
    if (!id) return badRequest("Invalid coach ID");

    await prisma.coach.delete({ where: { id } });
    return success({ message: "Coach deleted" });
  } catch (error) {
    return serverError(error);
  }
}
