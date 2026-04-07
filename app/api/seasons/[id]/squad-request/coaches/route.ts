import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth, isAuthError } from "@/lib/auth";
import { success, badRequest, forbidden, serverError, parseUUID } from "@/lib/api-helpers";
import { assertClubScope } from "@/lib/scope-guard";

interface CoachRequestItem {
    coachId: string;
    role: string; // head_coach | assistant_coach | goalkeeping_coach | fitness_coach | medical_staff
    status?: string; // active | reserve
    seasonClubId: string;
}

// POST /api/seasons/[id]/squad-request/coaches
// Club Admin submits a batch of coach squad requests for a season.
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
        const coaches: CoachRequestItem[] = body.coaches;

        if (!Array.isArray(coaches) || coaches.length === 0) {
            return badRequest("coaches array is required and must not be empty");
        }

        // Validate all seasonClubIds belong to the same club and caller has scope
        const seasonClubIds = [...new Set(coaches.map((c) => c.seasonClubId))];

        const seasonClubs = await prisma.seasonClub.findMany({
            where: { id: { in: seasonClubIds }, seasonId },
            include: { club: true },
        });

        if (seasonClubs.length !== seasonClubIds.length) {
            return badRequest("One or more seasonClubIds are invalid for this season");
        }

        const clubIds = [...new Set(seasonClubs.map((sc) => sc.clubId))];
        if (clubIds.length > 1) {
            return badRequest("All coach requests must belong to the same club");
        }

        const clubId = clubIds[0];
        if (!assertClubScope(auth, clubId)) return forbidden();

        // Upsert all SeasonClubCoach records with requestStatus = 'pending'
        const results = await prisma.$transaction(
            coaches.map((c) =>
                prisma.seasonClubCoach.upsert({
                    where: {
                        seasonClubId_coachId: {
                            seasonClubId: c.seasonClubId,
                            coachId: c.coachId,
                        },
                    },
                    create: {
                        seasonClubId: c.seasonClubId,
                        coachId: c.coachId,
                        role: c.role,
                        status: c.status ?? "active",
                        requestStatus: "pending",
                    },
                    update: {
                        role: c.role,
                        status: c.status ?? "active",
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
                        title: "Coach Squad Request Submitted",
                        body: `A club has submitted a coach squad request for season "${season.name}". ${results.length} coach(es) pending review.`,
                    },
                });
            }
        } catch {
            // Notification failure must not break the response
        }

        return success({ submitted: results.length, coaches: results });
    } catch (error) {
        return serverError(error);
    }
}
