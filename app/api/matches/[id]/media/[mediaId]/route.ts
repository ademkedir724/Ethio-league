import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth, isAuthError } from "@/lib/auth";
import { success, badRequest, notFound, forbidden, serverError, parseUUID } from "@/lib/api-helpers";
import { destroyAsset, extractPublicId } from "@/lib/cloudinary";
import { assertMEASeasonScope } from "@/lib/scope-guard";

// DELETE /api/matches/:id/media/:mediaId
export async function DELETE(
    req: NextRequest,
    { params }: { params: Promise<{ id: string; mediaId: string }> }
) {
    try {
        const auth = await requireAuth(req, ["super_admin", "league_admin", "match_event_admin"]);
        if (isAuthError(auth)) return auth;

        const { id: idStr, mediaId: mediaIdStr } = await params;
        const id = parseUUID(idStr);
        const mediaId = parseUUID(mediaIdStr);
        if (!id) return badRequest("Invalid match ID");
        if (!mediaId) return badRequest("Invalid media ID");

        const match = await prisma.match.findUnique({ where: { id }, select: { id: true, seasonId: true } });
        if (!match) return notFound("Match not found");

        if (!assertMEASeasonScope(auth, match.seasonId)) return forbidden();

        const media = await prisma.matchMedia.findUnique({ where: { id: mediaId } });
        if (!media || media.matchId !== id) return notFound("Media not found");

        await destroyAsset(extractPublicId(media.mediaUrl));
        await prisma.matchMedia.delete({ where: { id: mediaId } });

        return success({ message: "Media deleted" });
    } catch (error) {
        return serverError(error);
    }
}
