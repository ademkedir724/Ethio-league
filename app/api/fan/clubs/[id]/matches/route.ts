import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { success, badRequest, notFound, serverError, parseUUID } from "@/lib/api-helpers";

// GET /api/fan/clubs/[id]/matches
// Public — no auth required
// Query: ?seasonId, ?status, ?from (ISO date), ?to (ISO date)
export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const clubId = parseUUID(id);
        if (!clubId) return badRequest("Invalid club ID");

        const club = await prisma.club.findUnique({ where: { id: clubId }, select: { id: true } });
        if (!club) return notFound("Club not found");

        const { searchParams } = req.nextUrl;
        const seasonId = searchParams.get("seasonId");
        const status = searchParams.get("status");
        const from = searchParams.get("from");
        const to = searchParams.get("to");

        const matches = await prisma.match.findMany({
            where: {
                OR: [{ homeClubId: clubId }, { awayClubId: clubId }],
                ...(seasonId && { seasonId }),
                ...(status && { status }),
                ...(from && { matchDate: { gte: new Date(from) } }),
                ...(to && { matchDate: { lte: new Date(to) } }),
            },
            include: {
                homeClub: { select: { id: true, name: true, logoUrl: true } },
                awayClub: { select: { id: true, name: true, logoUrl: true } },
                stadium: { select: { id: true, name: true, city: true } },
                season: { select: { id: true, name: true } },
            },
            orderBy: { matchDate: "desc" },
        });

        // Annotate each match with result from this club's perspective
        const annotated = matches.map((m) => {
            const isHome = m.homeClubId === clubId;
            const gf = isHome ? m.homeScore : m.awayScore;
            const ga = isHome ? m.awayScore : m.homeScore;
            let result: "W" | "D" | "L" | null = null;
            if (m.status === "completed") {
                result = gf > ga ? "W" : gf === ga ? "D" : "L";
            }
            return {
                ...m,
                perspective: { isHome, goalsFor: gf, goalsAgainst: ga, result },
            };
        });

        return success(annotated);
    } catch (error) {
        return serverError(error);
    }
}

export { handleOptions as OPTIONS } from "@/lib/fan-cors";
