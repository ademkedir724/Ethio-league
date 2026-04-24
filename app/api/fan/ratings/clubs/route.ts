import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { success, serverError } from "@/lib/api-helpers";

// GET /api/fan/ratings/clubs
// Public — no auth required
// Query: ?leagueId, ?limit, ?search
export async function GET(req: NextRequest) {
    try {
        const { searchParams } = req.nextUrl;
        const leagueId = searchParams.get("leagueId");
        const limitParam = searchParams.get("limit");
        const search = searchParams.get("search");
        const limit = limitParam ? Math.max(1, Math.min(200, Number(limitParam))) : 50;

        // If filtering by league, get matching clubIds first
        let clubIdFilter: string[] | undefined;

        if (leagueId) {
            const clubs = await prisma.club.findMany({
                where: { leagueId, status: "active" },
                select: { id: true },
            });
            clubIdFilter = clubs.map((c) => c.id);
        }

        // Fetch ratings
        const ratings = await prisma.entityRating.findMany({
            where: {
                entityType: "club",
                ...(clubIdFilter && { entityId: { in: clubIdFilter } }),
            },
            orderBy: { score: "desc" },
            take: limit,
        });

        if (ratings.length === 0) return success([]);

        // Fetch club details
        const clubIds = ratings.map((r) => r.entityId);
        const clubs = await prisma.club.findMany({
            where: {
                id: { in: clubIds },
                status: "active",
                ...(search && { name: { contains: search, mode: "insensitive" } }),
            },
            include: {
                primaryStadium: { select: { id: true, name: true } },
                league: { select: { id: true, name: true } },
            },
        });

        const clubMap = new Map<string, typeof clubs[number]>(clubs.map((c) => [c.id, c]));

        const result = ratings
            .map((r, index) => {
                const club = clubMap.get(r.entityId);
                if (!club) return null;
                return {
                    rank: index + 1,
                    clubId: r.entityId,
                    name: club.name,
                    shortName: club.shortName,
                    logoUrl: club.logoUrl,
                    city: club.city,
                    country: club.country,
                    league: club.league,
                    stadium: club.primaryStadium,
                    ratingScore: r.score,
                    ratingComputedAt: r.computedAt,
                };
            })
            .filter(Boolean);

        return success(result);
    } catch (error) {
        return serverError(error);
    }
}

export { handleOptions as OPTIONS } from "@/lib/fan-cors";
