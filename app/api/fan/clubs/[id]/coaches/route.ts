import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { success, badRequest, notFound, serverError, parseUUID } from "@/lib/api-helpers";

// GET /api/fan/clubs/[id]/coaches
// Public — no auth required
// Query: ?seasonId
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

        const seasonId = req.nextUrl.searchParams.get("seasonId");

        const seasonClubCoaches = await prisma.seasonClubCoach.findMany({
            where: {
                seasonClub: {
                    clubId,
                    ...(seasonId && { seasonId }),
                },
                requestStatus: "approved",
            },
            include: {
                coach: {
                    include: {
                        images: { orderBy: { sortOrder: "asc" }, take: 1 },
                    },
                },
                seasonClub: {
                    include: {
                        season: { select: { id: true, name: true, status: true } },
                    },
                },
            },
            orderBy: { seasonClub: { season: { startDate: "desc" } } },
        });

        const coaches = seasonClubCoaches.map((scc) => ({
            coachId: scc.coachId,
            firstName: scc.coach.firstName,
            lastName: scc.coach.lastName,
            photoUrl: scc.coach.photoUrl,
            nationality: scc.coach.nationality,
            licenseLevel: scc.coach.licenseLevel,
            experienceYears: scc.coach.experienceYears,
            role: scc.role,
            season: scc.seasonClub.season,
            images: scc.coach.images,
        }));

        return success(coaches);
    } catch (error) {
        return serverError(error);
    }
}

export { handleOptions as OPTIONS } from "@/lib/fan-cors";
