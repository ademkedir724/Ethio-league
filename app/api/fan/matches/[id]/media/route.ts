import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { success, badRequest, notFound, serverError, parseUUID } from "@/lib/api-helpers";

// GET /api/fan/matches/[id]/media
// Public — no auth required
// Query: ?mediaType (image | video)
export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const matchId = parseUUID(id);
        if (!matchId) return badRequest("Invalid match ID");

        const match = await prisma.match.findUnique({ where: { id: matchId }, select: { id: true } });
        if (!match) return notFound("Match not found");

        const mediaType = req.nextUrl.searchParams.get("mediaType");

        const media = await prisma.matchMedia.findMany({
            where: {
                matchId,
                ...(mediaType && { mediaType }),
            },
            orderBy: { sortOrder: "asc" },
        });

        return success(media);
    } catch (error) {
        return serverError(error);
    }
}

export { handleOptions as OPTIONS } from "@/lib/fan-cors";
