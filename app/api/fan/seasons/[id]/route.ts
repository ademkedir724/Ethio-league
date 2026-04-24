import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { success, badRequest, notFound, serverError, parseUUID } from "@/lib/api-helpers";

// GET /api/fan/seasons/[id]
// Public — no auth required
export async function GET(
    _req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const seasonId = parseUUID(id);
        if (!seasonId) return badRequest("Invalid season ID");

        const season = await prisma.season.findUnique({
            where: { id: seasonId },
            include: {
                league: {
                    include: {
                        organization: { select: { id: true, name: true, logoUrl: true } },
                        leagueType: { select: { id: true, name: true } },
                    },
                },
                _count: { select: { seasonClubs: true, matches: true } },
            },
        });

        if (!season) return notFound("Season not found");

        return success(season);
    } catch (error) {
        return serverError(error);
    }
}

export { handleOptions as OPTIONS } from "@/lib/fan-cors";
