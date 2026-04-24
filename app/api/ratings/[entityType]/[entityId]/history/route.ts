import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth, isAuthError } from "@/lib/auth";
import { success, serverError } from "@/lib/api-helpers";

export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ entityType: string; entityId: string }> }
) {
    try {
        const auth = await requireAuth(req);
        if (isAuthError(auth)) return auth;

        const { entityType, entityId } = await params;

        const snapshots = await prisma.ratingSnapshot.findMany({
            where: { entityType, entityId },
            orderBy: { snapshotAt: "desc" },
        });

        return success(snapshots);
    } catch (error) {
        return serverError(error);
    }
}
