import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth, isAuthError } from "@/lib/auth";
import { success, badRequest, notFound, forbidden, serverError, parseUUID } from "@/lib/api-helpers";
import { assertLeagueScope } from "@/lib/scope-guard";

// PATCH /api/seasons/[id]/players/[scpId]/review
// League Admin approves or rejects a player squad request.
// Only requestStatus changes — jersey, position, playerRole are never touched.
export async function PATCH(
    req: NextRequest,
    { params }: { params: Promise<{ id: string; scpId: string }> }
) {
    try {
        const auth = await requireAuth(req, ["league_admin", "super_admin"]);
        if (isAuthError(auth)) return auth;

        const { id, scpId } = await params;
        const seasonId = parseUUID(id);
        const scpIdParsed = parseUUID(scpId);
        if (!seasonId) return badRequest("Invalid season ID");
        if (!scpIdParsed) return badRequest("Invalid SeasonClubPlayer ID");

        const season = await prisma.season.findUnique({
            where: { id: seasonId },
            include: { league: true },
        });
        if (!season) return notFound("Season not found");

        if (!assertLeagueScope(auth, season.leagueId)) return forbidden();

        const scp = await prisma.seasonClubPlayer.findUnique({
            where: { id: scpIdParsed },
            include: {
                seasonClub: { include: { club: true } },
                player: true,
            },
        });
        if (!scp) return notFound("SeasonClubPlayer record not found");
        if (scp.seasonClub.seasonId !== seasonId) return forbidden();

        const body = await req.json();
        const { action } = body;
        if (action !== "approve" && action !== "reject") {
            return badRequest("action must be 'approve' or 'reject'");
        }

        const newStatus = action === "approve" ? "approved" : "rejected";

        // Only update requestStatus — never touch jerseyNumber, positionId, playerRole
        const updated = await prisma.seasonClubPlayer.update({
            where: { id: scpIdParsed },
            data: { requestStatus: newStatus },
        });

        // Notify Club Admin
        try {
            const clubAdminScope = await prisma.userRoleScope.findFirst({
                where: {
                    clubId: scp.seasonClub.clubId,
                    role: { name: "club_admin" },
                },
                select: { userId: true },
            });
            if (clubAdminScope) {
                const playerName = `${scp.player.firstName} ${scp.player.lastName}`;
                await prisma.notification.create({
                    data: {
                        userId: clubAdminScope.userId,
                        title: `Player Request ${action === "approve" ? "Approved" : "Rejected"}`,
                        body: `${playerName}'s squad request for season "${season.name}" has been ${newStatus}.`,
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
