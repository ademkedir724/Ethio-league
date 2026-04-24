import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { success, badRequest, notFound, serverError, parseUUID } from "@/lib/api-helpers";

// GET /api/fan/leagues/[id]
// Public — no auth required
export async function GET(
    _req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const leagueId = parseUUID(id);
        if (!leagueId) return badRequest("Invalid league ID");

        const league = await prisma.league.findUnique({
            where: { id: leagueId },
            include: {
                organization: { select: { id: true, name: true, logoUrl: true, country: true, city: true } },
                leagueType: { select: { id: true, name: true } },
                seasons: {
                    select: { id: true, name: true, status: true, startDate: true, endDate: true },
                    orderBy: { startDate: "desc" },
                },
                _count: { select: { seasons: true, clubs: true } },
            },
        });

        if (!league) return notFound("League not found");

        // Fetch current rating
        const rating = await prisma.entityRating.findUnique({
            where: { entityType_entityId: { entityType: "league", entityId: leagueId } },
        });

        return success({ ...league, rating: rating ?? null });
    } catch (error) {
        return serverError(error);
    }
}

export { handleOptions as OPTIONS } from "@/lib/fan-cors";
