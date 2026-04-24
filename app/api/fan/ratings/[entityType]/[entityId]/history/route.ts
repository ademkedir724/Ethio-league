import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { success, badRequest, serverError, parseUUID } from "@/lib/api-helpers";

// GET /api/fan/ratings/[entityType]/[entityId]/history
// Public — no auth required
// entityType must be "player" or "club"
export async function GET(
    _req: NextRequest,
    { params }: { params: Promise<{ entityType: string; entityId: string }> }
) {
    try {
        const { entityType, entityId } = await params;

        if (entityType !== "player" && entityType !== "club") {
            return badRequest("entityType must be 'player' or 'club'");
        }

        const id = parseUUID(entityId);
        if (!id) return badRequest("Invalid entity ID");

        const snapshots = await prisma.ratingSnapshot.findMany({
            where: { entityType, entityId: id },
            orderBy: { snapshotAt: "desc" },
        });

        // Also include current rating
        const current = await prisma.entityRating.findUnique({
            where: { entityType_entityId: { entityType, entityId: id } },
        });

        return success({ current: current ?? null, history: snapshots });
    } catch (error) {
        return serverError(error);
    }
}

export { handleOptions as OPTIONS } from "@/lib/fan-cors";
