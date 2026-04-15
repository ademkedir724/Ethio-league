import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth, isAuthError } from "@/lib/auth";
import { success, serverError } from "@/lib/api-helpers";
import { getTier } from "@/lib/ratings";

export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ entityType: string }> }
) {
    try {
        const auth = await requireAuth(req);
        if (isAuthError(auth)) return auth;

        const { entityType } = await params;
        const page = parseInt(req.nextUrl.searchParams.get("page") ?? "1", 10);
        const pageSize = parseInt(req.nextUrl.searchParams.get("pageSize") ?? "20", 10);
        const skip = (page - 1) * pageSize;

        const [ratings, total] = await Promise.all([
            prisma.entityRating.findMany({
                where: { entityType },
                orderBy: { score: "desc" },
                skip,
                take: pageSize,
            }),
            prisma.entityRating.count({ where: { entityType } }),
        ]);

        return success({
            data: ratings.map((r) => ({
                entityId: r.entityId,
                score: Math.round(r.score * 100) / 100,
                tier: getTier(r.score),
                computedAt: r.computedAt,
            })),
            pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
        });
    } catch (error) {
        return serverError(error);
    }
}
