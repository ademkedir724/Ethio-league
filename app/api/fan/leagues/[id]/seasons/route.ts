import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { success, badRequest, notFound, serverError, parseUUID } from "@/lib/api-helpers";

// GET /api/fan/leagues/[id]/seasons
// Public — no auth required
// Query: ?status
export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const leagueId = parseUUID(id);
        if (!leagueId) return badRequest("Invalid league ID");

        const league = await prisma.league.findUnique({ where: { id: leagueId }, select: { id: true } });
        if (!league) return notFound("League not found");

        const status = req.nextUrl.searchParams.get("status");

        const seasons = await prisma.season.findMany({
            where: {
                leagueId,
                ...(status && { status }),
            },
            include: {
                _count: { select: { seasonClubs: true, matches: true } },
            },
            orderBy: { startDate: "desc" },
        });

        return success(seasons);
    } catch (error) {
        return serverError(error);
    }
}

export { handleOptions as OPTIONS } from "@/lib/fan-cors";
