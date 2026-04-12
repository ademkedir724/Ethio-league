import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth, isAuthError } from "@/lib/auth";
import { created, badRequest, notFound, forbidden, serverError, parseUUID, unprocessableEntity } from "@/lib/api-helpers";
import { isValidCloudinaryUrl } from "@/lib/cloudinary";
import { MEDIA_LIMITS } from "@/lib/media-limits";
import { assertMEASeasonScope } from "@/lib/scope-guard";

const VALID_MEDIA_TYPES = ["image", "video"] as const;

// POST /api/matches/:id/media
export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const auth = await requireAuth(req, ["super_admin", "league_admin", "match_event_admin"]);
        if (isAuthError(auth)) return auth;

        const { id: idStr } = await params;
        const id = parseUUID(idStr);
        if (!id) return badRequest("Invalid match ID");

        const match = await prisma.match.findUnique({ where: { id }, select: { id: true, seasonId: true } });
        if (!match) return notFound("Match not found");

        if (!assertMEASeasonScope(auth, match.seasonId)) return forbidden();

        const body = await req.json();
        const { url, mediaType, caption, sortOrder } = body;

        if (!mediaType || !VALID_MEDIA_TYPES.includes(mediaType)) {
            return badRequest("mediaType must be 'image' or 'video'");
        }

        if (!url || !isValidCloudinaryUrl(url)) {
            return badRequest("Invalid media URL: must be a Cloudinary URL");
        }

        const count = await prisma.matchMedia.count({ where: { matchId: id } });
        if (count >= MEDIA_LIMITS.match) {
            return unprocessableEntity({ error: `Match media limit of ${MEDIA_LIMITS.match} reached` });
        }

        const media = await prisma.matchMedia.create({
            data: {
                matchId: id,
                mediaUrl: url,
                mediaType,
                caption: caption ?? null,
                sortOrder: sortOrder ?? count + 1,
            },
        });

        return created(media);
    } catch (error) {
        return serverError(error);
    }
}
