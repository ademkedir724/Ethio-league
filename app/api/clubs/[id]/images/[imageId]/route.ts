import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth, isAuthError, hasRole, hasClubRole } from "@/lib/auth";
import { success, badRequest, notFound, serverError, parseUUID } from "@/lib/api-helpers";
import { destroyAsset, extractPublicId } from "@/lib/cloudinary";

// DELETE /api/clubs/:id/images/:imageId
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
        if (!id) return badRequest("Invalid club ID");
        if (!imageId) return badRequest("Invalid image ID");

        const isSuperAdmin = hasRole(auth, ["super_admin"]);
        const isOrgAdmin = hasRole(auth, ["organization_admin"]);
        const isClubAdmin = hasClubRole(auth, "club_admin", id);

        if (!isSuperAdmin && !isOrgAdmin && !isClubAdmin) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        const image = await prisma.clubImage.findUnique({ where: { id: imageId } });
        if (!image || image.clubId !== id) return notFound("Image not found");

        await destroyAsset(extractPublicId(image.imageUrl));
        await prisma.clubImage.delete({ where: { id: imageId } });

        return success({ message: "Image deleted" });
    } catch (error) {
        return serverError(error);
    }
}
