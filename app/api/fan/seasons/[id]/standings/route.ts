import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { success, badRequest, notFound, serverError, parseUUID } from "@/lib/api-helpers";
import { computeStandings, MatchResult } from "@/lib/standings";

// GET /api/fan/seasons/[id]/standings
// Public — no auth required
// Query: ?clubId (highlights that club's row)
export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const seasonId = parseUUID(id);
        if (!seasonId) return badRequest("Invalid season ID");

        const season = await prisma.season.findUnique({
            where: { id: seasonId },
            select: { id: true, pointsWin: true, pointsDraw: true },
        });
        if (!season) return notFound("Season not found");

        const clubId = req.nextUrl.searchParams.get("clubId");

        const matches = await prisma.match.findMany({
            where: { seasonId, status: "completed" },
            include: {
                homeClub: { select: { id: true, name: true, logoUrl: true } },
                awayClub: { select: { id: true, name: true, logoUrl: true } },
            },
        });

        const matchResults: MatchResult[] = matches.map((m) => ({
            homeClubId: m.homeClubId,
            awayClubId: m.awayClubId,
            homeScore: m.homeScore,
            awayScore: m.awayScore,
            homeClubName: m.homeClub.name,
            awayClubName: m.awayClub.name,
            homeClubLogoUrl: m.homeClub.logoUrl,
            awayClubLogoUrl: m.awayClub.logoUrl,
        }));

        const standings = computeStandings(matchResults, season.pointsWin, season.pointsDraw);

        // Add rank and optional highlight
        const result = standings.map((row, index) => ({
            rank: index + 1,
            ...row,
            ...(clubId && row.clubId === clubId ? { highlight: true } : {}),
        }));

        return success(result);
    } catch (error) {
        return serverError(error);
    }
}

export { handleOptions as OPTIONS } from "@/lib/fan-cors";
