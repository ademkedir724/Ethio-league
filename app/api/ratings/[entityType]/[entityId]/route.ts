import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth, isAuthError } from "@/lib/auth";
import { success, notFound, serverError } from "@/lib/api-helpers";
import { getTier } from "@/lib/ratings";

export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ entityType: string; entityId: string }> }
) {
    try {
        const auth = await requireAuth(req);
        if (isAuthError(auth)) return auth;

        const { entityType, entityId } = await params;

        const rating = await prisma.entityRating.findUnique({
            where: { entityType_entityId: { entityType, entityId } },
        });

        if (!rating) return notFound("No rating found for this entity");

        return success({
            score: Math.round(rating.score * 100) / 100,
            tier: getTier(rating.score),
            computedAt: rating.computedAt,
        });
    } catch (error) {
        return serverError(error);
    }
}
