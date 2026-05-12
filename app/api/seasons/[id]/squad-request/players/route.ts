import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth, isAuthError } from "@/lib/auth";
import { success, badRequest, forbidden, serverError, parseUUID } from "@/lib/api-helpers";
import { assertClubScope } from "@/lib/scope-guard";

interface PlayerRequestItem {
    playerId: string;
    jerseyNumber?: number;
    positionId?: number;
    playerRole?: string; // 'starter' | 'reserve'
    seasonClubId: string;
}

// POST /api/seasons/[id]/squad-request/players
// Club Admin submits a batch of player squad requests for a season.
// All submitted records are set to requestStatus = 'pending'.
export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const auth = await requireAuth(req, ["club_admin", "super_admin"]);
        if (isAuthError(auth)) return auth;

        const { id } = await params;
        const seasonId = parseUUID(id);
        if (!seasonId) return badRequest("Invalid season ID");

        const season = await prisma.season.findUnique({
            where: { id: seasonId },
            include: { league: true },
        });
        if (!season) return badRequest("Season not found");

        const body = await req.json();
        const players: PlayerRequestItem[] = body.players;

        if (!Array.isArray(players) || players.length === 0) {
            return badRequest("players array is required and must not be empty");
        }

        // Validate all seasonClubIds belong to the same club and caller has scope
        const seasonClubIds = [...new Set(players.map((p) => p.seasonClubId))];

        const seasonClubs = await prisma.seasonClub.findMany({
            where: { id: { in: seasonClubIds }, seasonId },
            include: { club: true },
        });

        if (seasonClubs.length !== seasonClubIds.length) {
            return badRequest("One or more seasonClubIds are invalid for this season");
        }

        // All requests must belong to the same club (Club Admin is scoped to one club)
        const clubIds = [...new Set(seasonClubs.map((sc) => sc.clubId as string))];
        if (clubIds.length > 1) {
            return badRequest("All player requests must belong to the same club");
        }

        const clubId = clubIds[0] as string;
        if (!assertClubScope(auth, clubId)) return forbidden();

        // Guard: club must be active before submitting squad requests
        const club = await prisma.club.findUnique({ where: { id: clubId }, select: { status: true, name: true } });
        if (!club) return badRequest("Club not found");
        if (club.status !== "active") {
            return forbidden(`Club "${club.name}" is not active (status: ${club.status}). Squad requests can only be submitted by active clubs.`);
        }

        // Validate jersey number uniqueness within each seasonClub
        for (const sc of seasonClubs) {
            const requestsForClub = players.filter((p) => p.seasonClubId === sc.id);
            const jerseyNumbers = requestsForClub
                .map((p) => p.jerseyNumber)
                .filter((n): n is number => n != null);

            // Check for duplicates within the submitted batch
            const uniqueJerseys = new Set(jerseyNumbers);
            if (uniqueJerseys.size !== jerseyNumbers.length) {
                return badRequest(`Duplicate jersey numbers in submission for club ${sc.club.name}`);
            }

            // Check against existing approved/pending records for this seasonClub
            if (jerseyNumbers.length > 0) {
                const playerIds = requestsForClub.map((p) => p.playerId);
                const existing = await prisma.seasonClubPlayer.findMany({
                    where: {
                        seasonClubId: sc.id,
                        jerseyNumber: { in: jerseyNumbers },
                        requestStatus: { in: ["approved", "pending"] },
                        // Exclude the players being re-submitted (allow resubmission)
                        playerId: { notIn: playerIds },
                    },
                });
                if (existing.length > 0) {
                    const taken = existing.map((e) => e.jerseyNumber).join(", ");
                    return badRequest(`Jersey number(s) ${taken} already taken in this season for club ${sc.club.name}`);
                }
            }
        }

        // Validate no player is already approved in another club for this season
        const playerIds = players.map((p) => p.playerId);
        const crossClubConflicts = await prisma.seasonClubPlayer.findMany({
            where: {
                playerId: { in: playerIds },
                requestStatus: "approved",
                seasonClub: {
                    seasonId,
                    clubId: { not: clubId },
                },
            },
            include: { player: true, seasonClub: { include: { club: true } } },
        });

        if (crossClubConflicts.length > 0) {
            const names = crossClubConflicts
                .map((c) => `${c.player.firstName} ${c.player.lastName} (approved at ${c.seasonClub.club.name})`)
                .join(", ");
            return badRequest(`Player(s) already approved in another club this season: ${names}`);
        }

        // Upsert all SeasonClubPlayer records with requestStatus = 'pending'
        const results = await prisma.$transaction(
            players.map((p) =>
                prisma.seasonClubPlayer.upsert({
                    where: {
                        seasonClubId_playerId: {
                            seasonClubId: p.seasonClubId,
                            playerId: p.playerId,
                        },
                    },
                    create: {
                        seasonClubId: p.seasonClubId,
                        playerId: p.playerId,
                        jerseyNumber: p.jerseyNumber ?? null,
                        positionId: p.positionId ?? null,
                        playerRole: p.playerRole ?? null,
                        requestStatus: "pending",
                    },
                    update: {
                        jerseyNumber: p.jerseyNumber ?? null,
                        positionId: p.positionId ?? null,
                        playerRole: p.playerRole ?? null,
                        requestStatus: "pending",
                    },
                })
            )
        );

        // Notify League Admin
        try {
            const leagueAdminScope = await prisma.userRoleScope.findFirst({
                where: {
                    leagueId: season.leagueId,
                    role: { name: "league_admin" },
                },
                select: { userId: true },
            });
            if (leagueAdminScope) {
                await prisma.notification.create({
                    data: {
                        userId: leagueAdminScope.userId,
                        title: "Squad Request Submitted",
                        body: `A club has submitted a player squad request for season "${season.name}". ${results.length} player(s) pending review.`,
                    },
                });
            }
        } catch {
            // Notification failure must not break the response
        }

        return success({ submitted: results.length, players: results });
    } catch (error) {
        return serverError(error);
    }
}
