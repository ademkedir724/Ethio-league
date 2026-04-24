import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { success, badRequest, notFound, serverError, parseUUID } from "@/lib/api-helpers";

// GET /api/fan/seasons/[id]/matches
// Public — no auth required
// Query: ?round, ?clubId, ?status, ?from (ISO date), ?to (ISO date)
export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const seasonId = parseUUID(id);
        if (!seasonId) return badRequest("Invalid season ID");

        const season = await prisma.season.findUnique({ where: { id: seasonId }, select: { id: true } });
        if (!season) return notFound("Season not found");

        const { searchParams } = req.nextUrl;
        const round = searchParams.get("round");
        const clubId = searchParams.get("clubId");
        const status = searchParams.get("status");
        const from = searchParams.get("from");
        const to = searchParams.get("to");

        const matches = await prisma.match.findMany({
            where: {
                seasonId,
                ...(round && { roundNumber: Number(round) }),
                ...(clubId && { OR: [{ homeClubId: clubId }, { awayClubId: clubId }] }),
                ...(status && { status }),
                ...(from && { matchDate: { gte: new Date(from) } }),
                ...(to && { matchDate: { lte: new Date(to) } }),
            },
            include: {
                homeClub: { select: { id: true, name: true, logoUrl: true } },
                awayClub: { select: { id: true, name: true, logoUrl: true } },
                stadium: { select: { id: true, name: true, city: true } },
            },
            orderBy: { matchDate: "asc" },
        });

        return success(matches);
    } catch (error) {
        return serverError(error);
    }
}

export { handleOptions as OPTIONS } from "@/lib/fan-cors";
