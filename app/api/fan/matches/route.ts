import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { success, serverError } from "@/lib/api-helpers";

// GET /api/fan/matches
// Public — no auth required
// Query: ?seasonId, ?clubId, ?status, ?round, ?from (ISO date), ?to (ISO date), ?stadiumId
export async function GET(req: NextRequest) {
    try {
        const { searchParams } = req.nextUrl;
        const seasonId = searchParams.get("seasonId");
        const clubId = searchParams.get("clubId");
        const status = searchParams.get("status");
        const round = searchParams.get("round");
        const from = searchParams.get("from");
        const to = searchParams.get("to");
        const stadiumId = searchParams.get("stadiumId");

        const matches = await prisma.match.findMany({
            where: {
                ...(seasonId && { seasonId }),
                ...(clubId && { OR: [{ homeClubId: clubId }, { awayClubId: clubId }] }),
                ...(status && { status }),
                ...(round && { roundNumber: Number(round) }),
                ...(from && { matchDate: { gte: new Date(from) } }),
                ...(to && { matchDate: { lte: new Date(to) } }),
                ...(stadiumId && { stadiumId }),
            },
            include: {
                homeClub: { select: { id: true, name: true, logoUrl: true } },
                awayClub: { select: { id: true, name: true, logoUrl: true } },
                stadium: { select: { id: true, name: true, city: true } },
                season: { select: { id: true, name: true } },
            },
            orderBy: { matchDate: "desc" },
        });

        return success(matches);
    } catch (error) {
        return serverError(error);
    }
}

export { handleOptions as OPTIONS } from "@/lib/fan-cors";
