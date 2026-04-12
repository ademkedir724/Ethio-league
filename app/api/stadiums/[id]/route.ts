import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth, isAuthError } from "@/lib/auth";
import { success, badRequest, notFound, serverError, parseUUID } from "@/lib/api-helpers";
import { destroyAsset, extractPublicId } from "@/lib/cloudinary";

// GET /api/stadiums/:id
export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const auth = await requireAuth(req);
        if (isAuthError(auth)) return auth;

        const { id: idStr } = await params;
        const id = parseUUID(idStr);
        if (!id) return badRequest("Invalid stadium ID");

        const stadium = await prisma.stadium.findUnique({
            where: { id },
            include: { ownerClub: { select: { id: true, name: true } } },
        });

        if (!stadium) return notFound("Stadium not found");
        return success(stadium);
    } catch (error) {
        return serverError(error);
    }
}

// DELETE /api/stadiums/:id
export async function DELETE(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const auth = await requireAuth(req, ["super_admin", "organization_admin"]);
        if (isAuthError(auth)) return auth;

        const { id: idStr } = await params;
        const id = parseUUID(idStr);
        if (!id) return badRequest("Invalid stadium ID");

        const stadium = await prisma.stadium.findUnique({ where: { id } });
        if (!stadium) return notFound("Stadium not found");

        const images = await prisma.stadiumImage.findMany({ where: { stadiumId: id }, select: { imageUrl: true } });
        await Promise.all(images.map((img) => destroyAsset(extractPublicId(img.imageUrl))));

        await prisma.stadium.delete({ where: { id } });
        return success({ message: "Stadium deleted" });
    } catch (error) {
        return serverError(error);
    }
}
