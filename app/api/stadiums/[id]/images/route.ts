import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth, isAuthError, hasRole, hasClubRole } from "@/lib/auth";
import { success, created, badRequest, serverError, parseUUID, unprocessableEntity } from "@/lib/api-helpers";
import { isValidCloudinaryUrl } from "@/lib/cloudinary";
import { MEDIA_LIMITS } from "@/lib/media-limits";

// GET /api/stadiums/:id/images
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

        const images = await prisma.stadiumImage.findMany({
            where: { stadiumId: id },
            orderBy: { sortOrder: "asc" },
        });

        return success(images);
    } catch (error) {
        return serverError(error);
    }
}

// POST /api/stadiums/:id/images
export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const auth = await requireAuth(req);
        if (isAuthError(auth)) return auth;

        const { id: idStr } = await params;
        const id = parseUUID(idStr);
        if (!id) return badRequest("Invalid stadium ID");

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

        const count = await prisma.stadiumImage.count({ where: { stadiumId: id } });
        if (count >= MEDIA_LIMITS.stadium) {
            return unprocessableEntity({ error: `Stadium image limit of ${MEDIA_LIMITS.stadium} reached` });
        }

        const image = await prisma.stadiumImage.create({
            data: {
                stadiumId: id,
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
