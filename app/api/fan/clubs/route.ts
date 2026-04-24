import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { success, serverError } from "@/lib/api-helpers";

// GET /api/fan/clubs
// Public — no auth required
// Query: ?search, ?leagueId, ?city, ?country
export async function GET(req: NextRequest) {
    try {
        const { searchParams } = req.nextUrl;
        const search = searchParams.get("search");
        const leagueId = searchParams.get("leagueId");
        const city = searchParams.get("city");
        const country = searchParams.get("country");

        const clubs = await prisma.club.findMany({
            where: {
                status: "active",
                ...(search && { name: { contains: search, mode: "insensitive" } }),
                ...(leagueId && { leagueId }),
                ...(city && { city: { contains: city, mode: "insensitive" } }),
                ...(country && { country: { contains: country, mode: "insensitive" } }),
            },
            include: {
                primaryStadium: { select: { id: true, name: true, city: true, capacity: true } },
                league: { select: { id: true, name: true } },
                _count: { select: { seasonClubs: true } },
            },
            orderBy: { name: "asc" },
        });

        return success(clubs);
    } catch (error) {
        return serverError(error);
    }
}

export { handleOptions as OPTIONS } from "@/lib/fan-cors";
