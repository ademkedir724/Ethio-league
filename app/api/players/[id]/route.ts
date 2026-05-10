import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth, isAuthError } from "@/lib/auth";
import { success, badRequest, notFound, serverError, parseUUID } from "@/lib/api-helpers";
import { isValidCloudinaryUrl, destroyAsset, extractPublicId } from "@/lib/cloudinary";

// GET /api/players/:id
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth(req);
    if (isAuthError(auth)) return auth;

    const { id: idStr } = await params;
    const id = parseUUID(idStr);
    if (!id) return badRequest("Invalid player ID");

    const player = await prisma.player.findUnique({
      where: { id },
      include: {
        primaryPosition: true,
        originClub: { select: { id: true, name: true } },
        seasonClubPlayers: {
          include: {
            seasonClub: {
              include: {
                season: { select: { id: true, name: true, status: true, leagueId: true } },
                club: { select: { id: true, name: true } },
              },
            },
            position: true,
          },
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!player) return notFound("Player not found");
    return success(player);
  } catch (error) {
    return serverError(error);
  }
}

// PATCH /api/players/:id
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
    if (!id) return badRequest("Invalid player ID");

    const data = await req.json();
    const allowedFields = [
      "firstName", "lastName", "dateOfBirth", "nationality",
      "heightCm", "weightKg", "preferredFoot", "primaryPositionId",
      "photoUrl", "status",
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

    if (updateData.photoUrl !== undefined && !isValidCloudinaryUrl(updateData.photoUrl as string)) {
      return badRequest("Invalid media URL: must be a Cloudinary URL");
    }

    const player = await prisma.player.update({
      where: { id },
      data: updateData,
      include: { primaryPosition: true },
    });

    return success(player);
  } catch (error) {
    return serverError(error);
  }
}

// DELETE /api/players/:id
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth(req, ["super_admin", "organization_admin"]);
    if (isAuthError(auth)) return auth;

    const { id: idStr } = await params;
    const id = parseUUID(idStr);
    if (!id) return badRequest("Invalid player ID");

    const images = await prisma.playerImage.findMany({ where: { playerId: id }, select: { imageUrl: true } });
    await Promise.all(images.map((img: { imageUrl: string }) => destroyAsset(extractPublicId(img.imageUrl))));

    await prisma.player.delete({ where: { id } });
    return success({ message: "Player deleted" });
  } catch (error) {
    return serverError(error);
  }
}
