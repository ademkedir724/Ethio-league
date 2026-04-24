import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { success, badRequest, notFound, serverError, parseUUID } from "@/lib/api-helpers";
import { computeStandings, MatchResult } from "@/lib/standings";

// GET /api/fan/clubs/[id]
// Public — no auth required
export async function GET(
    _req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const clubId = parseUUID(id);
        if (!clubId) return badRequest("Invalid club ID");

        const club = await prisma.club.findUnique({
            where: { id: clubId },
            include: {
                primaryStadium: {
                    include: {
                        images: { orderBy: { sortOrder: "asc" }, take: 3 },
                    },
                },
                league: { select: { id: true, name: true } },
                images: { orderBy: { sortOrder: "asc" }, take: 5 },
            },
        });

        if (!club) return notFound("Club not found");

        // Find most recent active/ongoing season for this club
        const latestSeasonClub = await prisma.seasonClub.findFirst({
            where: {
                clubId,
                season: { status: { in: ["active", "completed"] } },
            },
            include: {
                season: { select: { id: true, name: true, status: true, pointsWin: true, pointsDraw: true } },
                players: {
                    where: { requestStatus: "approved" },
                    include: {
                        player: { select: { id: true, firstName: true, lastName: true, photoUrl: true } },
                        position: { select: { id: true, name: true, code: true } },
                    },
                    orderBy: { jerseyNumber: "asc" },
                },
                coaches: {
                    where: { requestStatus: "approved" },
                    include: {
                        coach: { select: { id: true, firstName: true, lastName: true, photoUrl: true, nationality: true } },
                    },
                },
            },
            orderBy: { season: { startDate: "desc" } },
        });

        // Compute current standing if season exists
        let currentStanding: Record<string, unknown> | null = null;
        if (latestSeasonClub) {
            const matches = await prisma.match.findMany({
                where: { seasonId: latestSeasonClub.seasonId, status: "completed" },
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

            const standings = computeStandings(
                matchResults,
                latestSeasonClub.season.pointsWin,
                latestSeasonClub.season.pointsDraw
            );
            const idx = standings.findIndex((s) => s.clubId === clubId);
            if (idx !== -1) {
                currentStanding = { rank: idx + 1, ...standings[idx], seasonName: latestSeasonClub.season.name };
            }
        }

        // Fetch rating
        const rating = await prisma.entityRating.findUnique({
            where: { entityType_entityId: { entityType: "club", entityId: clubId } },
        });

        return success({
            ...club,
            currentSeason: latestSeasonClub
                ? {
                    seasonId: latestSeasonClub.seasonId,
                    seasonName: latestSeasonClub.season.name,
                    seasonStatus: latestSeasonClub.season.status,
                    squad: latestSeasonClub.players.map((p) => ({
                        playerId: p.playerId,
                        firstName: p.player.firstName,
                        lastName: p.player.lastName,
                        photoUrl: p.player.photoUrl,
                        jerseyNumber: p.jerseyNumber,
                        position: p.position,
                    })),
                    coaches: latestSeasonClub.coaches.map((c) => ({
                        coachId: c.coachId,
                        firstName: c.coach.firstName,
                        lastName: c.coach.lastName,
                        photoUrl: c.coach.photoUrl,
                        nationality: c.coach.nationality,
                        role: c.role,
                    })),
                }
                : null,
            currentStanding,
            rating: rating ?? null,
        });
    } catch (error) {
        return serverError(error);
    }
}

export { handleOptions as OPTIONS } from "@/lib/fan-cors";
