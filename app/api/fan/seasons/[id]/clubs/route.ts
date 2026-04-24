import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { success, badRequest, notFound, serverError, parseUUID } from "@/lib/api-helpers";

// GET /api/fan/seasons/[id]/clubs
// Public — no auth required
// Query: ?search
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

        const search = req.nextUrl.searchParams.get("search");

        const seasonClubs = await prisma.seasonClub.findMany({
            where: {
                seasonId,
                club: {
                    ...(search && { name: { contains: search, mode: "insensitive" } }),
                },
            },
            include: {
                club: {
                    include: {
                        primaryStadium: { select: { id: true, name: true, city: true, capacity: true } },
                        _count: { select: { players: true } },
                    },
                },
                _count: { select: { players: true, coaches: true } },
            },
            orderBy: { club: { name: "asc" } },
        });

        const clubs = seasonClubs.map((sc) => ({
            ...sc.club,
            seasonClubId: sc.id,
            registrationDate: sc.registrationDate,
            squadSize: sc._count.players,
            coachCount: sc._count.coaches,
        }));

        return success(clubs);
    } catch (error) {
        return serverError(error);
    }
}

export { handleOptions as OPTIONS } from "@/lib/fan-cors";
