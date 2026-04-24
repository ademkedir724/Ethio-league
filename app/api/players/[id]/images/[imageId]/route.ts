import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth, isAuthError, hasRole } from "@/lib/auth";
import { success, badRequest, notFound, serverError, parseUUID } from "@/lib/api-helpers";
import { destroyAsset, extractPublicId } from "@/lib/cloudinary";

// DELETE /api/players/:id/images/:imageId
export async function DELETE(
    req: NextRequest,
    { params }: { params: Promise<{ id: string; imageId: string }> }
) {
    try {
        const auth = await requireAuth(req);
        if (isAuthError(auth)) return auth;

        const { id: idStr, imageId: imageIdStr } = await params;
        const id = parseUUID(idStr);
        const imageId = parseUUID(imageIdStr);
        if (!id) return badRequest("Invalid player ID");
        if (!imageId) return badRequest("Invalid image ID");

        const isSuperAdmin = hasRole(auth, ["super_admin"]);
        const isOrgAdmin = hasRole(auth, ["organization_admin"]);
        const isLeagueAdmin = hasRole(auth, ["league_admin"]);
        const isClubAdmin = hasRole(auth, ["club_admin"]);

        if (!isSuperAdmin && !isOrgAdmin && !isLeagueAdmin && !isClubAdmin) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        const image = await prisma.playerImage.findUnique({ where: { id: imageId } });
        if (!image || image.playerId !== id) return notFound("Image not found");

        await destroyAsset(extractPublicId(image.imageUrl));
        await prisma.playerImage.delete({ where: { id: imageId } });

        return success({ message: "Image deleted" });
    } catch (error) {
        return serverError(error);
    }
}
