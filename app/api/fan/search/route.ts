import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { success, badRequest, serverError } from "@/lib/api-helpers";

const SEARCH_LIMIT = 10;

// GET /api/fan/search
// Public — no auth required
// Query: ?q (required), ?type (league | club | player | coach | match)
export async function GET(req: NextRequest) {
    try {
        const { searchParams } = req.nextUrl;
        const q = searchParams.get("q");
        const type = searchParams.get("type");

        if (!q || q.trim() === "") {
            return badRequest("Query parameter 'q' is required");
        }

        const searchTerm = q.trim();
        const validTypes = ["league", "club", "player", "coach", "match"];
        if (type && !validTypes.includes(type)) {
            return badRequest(`type must be one of: ${validTypes.join(", ")}`);
        }

        const runAll = !type;

        const [leagues, clubs, players, coaches, matches] = await Promise.all([
            // Leagues
            runAll || type === "league"
                ? prisma.league.findMany({
                    where: {
                        status: "active",
                        name: { contains: searchTerm, mode: "insensitive" },
                    },
                    include: {
                        organization: { select: { id: true, name: true } },
                        leagueType: { select: { id: true, name: true } },
                    },
                    take: SEARCH_LIMIT,
                })
                : Promise.resolve([]),

            // Clubs
            runAll || type === "club"
                ? prisma.club.findMany({
                    where: {
                        status: "active",
                        name: { contains: searchTerm, mode: "insensitive" },
                    },
                    include: {
                        primaryStadium: { select: { id: true, name: true } },
                        league: { select: { id: true, name: true } },
                    },
                    take: SEARCH_LIMIT,
                })
                : Promise.resolve([]),

            // Players
            runAll || type === "player"
                ? prisma.player.findMany({
                    where: {
                        status: "active",
                        OR: [
                            { firstName: { contains: searchTerm, mode: "insensitive" } },
                            { lastName: { contains: searchTerm, mode: "insensitive" } },
                        ],
                    },
                    include: {
                        primaryPosition: { select: { id: true, name: true, code: true } },
                        originClub: { select: { id: true, name: true, logoUrl: true } },
                    },
                    take: SEARCH_LIMIT,
                })
                : Promise.resolve([]),

            // Coaches
            runAll || type === "coach"
                ? prisma.coach.findMany({
                    where: {
                        status: "active",
                        OR: [
                            { firstName: { contains: searchTerm, mode: "insensitive" } },
                            { lastName: { contains: searchTerm, mode: "insensitive" } },
                        ],
                    },
                    include: {
                        originClub: { select: { id: true, name: true, logoUrl: true } },
                    },
                    take: SEARCH_LIMIT,
                })
                : Promise.resolve([]),

            // Matches (search by club name)
            runAll || type === "match"
                ? prisma.match.findMany({
                    where: {
                        OR: [
                            { homeClub: { name: { contains: searchTerm, mode: "insensitive" } } },
                            { awayClub: { name: { contains: searchTerm, mode: "insensitive" } } },
                        ],
                    },
                    include: {
                        homeClub: { select: { id: true, name: true, logoUrl: true } },
                        awayClub: { select: { id: true, name: true, logoUrl: true } },
                        season: { select: { id: true, name: true } },
                        stadium: { select: { id: true, name: true } },
                    },
                    orderBy: { matchDate: "desc" },
                    take: SEARCH_LIMIT,
                })
                : Promise.resolve([]),
        ]);

        return success({
            query: searchTerm,
            leagues,
            clubs,
            players,
            coaches,
            matches,
        });
    } catch (error) {
        return serverError(error);
    }
}

export { handleOptions as OPTIONS } from "@/lib/fan-cors";
