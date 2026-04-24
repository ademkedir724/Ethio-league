import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth, isAuthError, hasRole } from "@/lib/auth";
import { created, badRequest, serverError, parseUUID, unprocessableEntity } from "@/lib/api-helpers";
import { isValidCloudinaryUrl } from "@/lib/cloudinary";
import { MEDIA_LIMITS } from "@/lib/media-limits";

// POST /api/players/:id/images
export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const auth = await requireAuth(req);
        if (isAuthError(auth)) return auth;

        const { id: idStr } = await params;
        const id = parseUUID(idStr);
        if (!id) return badRequest("Invalid player ID");

        const isSuperAdmin = hasRole(auth, ["super_admin"]);
        const isOrgAdmin = hasRole(auth, ["organization_admin"]);
        const isLeagueAdmin = hasRole(auth, ["league_admin"]);
        const isClubAdmin = hasRole(auth, ["club_admin"]);

        if (!isSuperAdmin && !isOrgAdmin && !isLeagueAdmin && !isClubAdmin) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        const body = await req.json();
        const { url, caption, sortOrder } = body;

        if (!url || !isValidCloudinaryUrl(url)) {
            return badRequest("Invalid media URL: must be a Cloudinary URL");
        }

        const count = await prisma.playerImage.count({ where: { playerId: id } });
        if (count >= MEDIA_LIMITS.player) {
            return unprocessableEntity({ error: `Player image limit of ${MEDIA_LIMITS.player} reached` });
        }

        const image = await prisma.playerImage.create({
            data: {
                playerId: id,
                imageUrl: url,
                caption: caption ?? null,
                sortOrder: sortOrder ?? count + 1,
            },
        });

        return created(image);
    } catch (error) {
        return serverError(error);
    }
}
