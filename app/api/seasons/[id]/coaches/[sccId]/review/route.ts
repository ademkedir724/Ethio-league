import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth, isAuthError } from "@/lib/auth";
import { success, badRequest, notFound, forbidden, serverError, parseUUID } from "@/lib/api-helpers";
import { assertLeagueScope } from "@/lib/scope-guard";

// PATCH /api/seasons/[id]/coaches/[sccId]/review
// League Admin approves or rejects a coach squad request.
// Only requestStatus changes — role and status are never touched.
export async function PATCH(
    req: NextRequest,
    { params }: { params: Promise<{ id: string; sccId: string }> }
) {
    try {
        const auth = await requireAuth(req, ["league_admin", "super_admin"]);
        if (isAuthError(auth)) return auth;

        const { id, sccId } = await params;
        const seasonId = parseUUID(id);
        const sccIdParsed = parseUUID(sccId);
        if (!seasonId) return badRequest("Invalid season ID");
        if (!sccIdParsed) return badRequest("Invalid SeasonClubCoach ID");

        const season = await prisma.season.findUnique({
            where: { id: seasonId },
            include: { league: true },
        });
        if (!season) return notFound("Season not found");

        if (!assertLeagueScope(auth, season.leagueId)) return forbidden();

        const scc = await prisma.seasonClubCoach.findUnique({
            where: { id: sccIdParsed },
            include: {
                seasonClub: { include: { club: true } },
                coach: true,
            },
        });
        if (!scc) return notFound("SeasonClubCoach record not found");
        if (scc.seasonClub.seasonId !== seasonId) return forbidden();

        const body = await req.json();
        const { action } = body;
        if (action !== "approve" && action !== "reject") {
            return badRequest("action must be 'approve' or 'reject'");
        }

        const newStatus = action === "approve" ? "approved" : "rejected";

        // Only update requestStatus — never touch role or status
        const updated = await prisma.seasonClubCoach.update({
            where: { id: sccIdParsed },
            data: { requestStatus: newStatus },
        });

        // Notify Club Admin
        try {
            const clubAdminScope = await prisma.userRoleScope.findFirst({
                where: {
                    clubId: scc.seasonClub.clubId,
                    role: { name: "club_admin" },
                },
                select: { userId: true },
            });
            if (clubAdminScope) {
                const coachName = `${scc.coach.firstName} ${scc.coach.lastName}`;
                await prisma.notification.create({
                    data: {
                        userId: clubAdminScope.userId,
                        title: `Coach Request ${action === "approve" ? "Approved" : "Rejected"}`,
                        body: `${coachName}'s squad request for season "${season.name}" has been ${newStatus}.`,
                    },
                });
            }
        } catch {
            // Notification failure must not break the response
        }

        return success(updated);
    } catch (error) {
        return serverError(error);
    }
}
