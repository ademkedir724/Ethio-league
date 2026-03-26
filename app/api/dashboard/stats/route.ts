import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth, isAuthError } from "@/lib/auth";
import { success, serverError } from "@/lib/api-helpers";

// GET /api/dashboard/stats — scoped aggregate stats based on caller's role
export async function GET(req: NextRequest) {
    try {
        const auth = await requireAuth(req);
        if (isAuthError(auth)) return auth;

        const isSuperAdmin = auth.roles.some((r) => r.roleName === "super_admin");
        const isOrgAdmin = auth.roles.some((r) => r.roleName === "organization_admin");
        const isLeagueAdmin = auth.roles.some((r) => r.roleName === "league_admin");
        const isClubAdmin = auth.roles.some((r) => r.roleName === "club_admin");
        const isMEA = auth.roles.some((r) => r.roleName === "match_event_admin");

        if (isSuperAdmin) {
            const [organizations, clubs, players, users, seasons, matches] = await Promise.all([
                prisma.organization.count(),
                prisma.club.count(),
                prisma.player.count(),
                prisma.user.count(),
                prisma.season.count(),
                prisma.match.count(),
            ]);
            return success({ organizations, clubs, players, users, seasons, matches });
        }

        if (isOrgAdmin) {
            const orgId = auth.roles.find((r) => r.roleName === "organization_admin")?.organizationId;
            if (!orgId) return success({});

            const orgAdminRoleId = await prisma.role.findUnique({ where: { name: "organization_admin" }, select: { id: true } });
            const meaRoleId = await prisma.role.findUnique({ where: { name: "match_event_admin" }, select: { id: true } });

            const [totalLeagues, activeLeagues, totalClubs, pendingClubs, totalReferees, totalMatchEventAdmins, upcomingMatches] = await Promise.all([
                prisma.season.count({ where: { organizationId: orgId } }),
                prisma.season.count({ where: { organizationId: orgId, status: "active" } }),
                prisma.club.count({ where: { seasonClubs: { some: { season: { organizationId: orgId } } } } }),
                prisma.club.count({ where: { status: "pending", seasonClubs: { some: { season: { organizationId: orgId } } } } }),
                prisma.referee.count({ where: { refereeLeagues: { some: { season: { organizationId: orgId } } } } }),
                meaRoleId ? prisma.userRoleScope.count({ where: { roleId: meaRoleId.id, organizationId: orgId } }) : Promise.resolve(0),
                prisma.match.count({ where: { season: { organizationId: orgId }, status: { in: ["scheduled", "upcoming"] } } }),
            ]);

            return success({ totalLeagues, activeLeagues, totalClubs, pendingClubs, totalReferees, totalMatchEventAdmins, upcomingMatches });
        }

        if (isLeagueAdmin) {
            const seasonId = auth.roles.find((r) => r.roleName === "league_admin")?.seasonId;
            if (!seasonId) return success({});

            const [clubs, totalMatches, completedMatches, liveMatches, upcomingMatches] = await Promise.all([
                prisma.seasonClub.count({ where: { seasonId } }),
                prisma.match.count({ where: { seasonId } }),
                prisma.match.count({ where: { seasonId, status: "completed" } }),
                prisma.match.count({ where: { seasonId, status: "live" } }),
                prisma.match.count({ where: { seasonId, status: { in: ["scheduled", "upcoming"] } } }),
            ]);

            return success({ clubs, totalMatches, completedMatches, liveMatches, upcomingMatches });
        }

        if (isClubAdmin) {
            const clubId = auth.roles.find((r) => r.roleName === "club_admin")?.clubId;
            if (!clubId) return success({});

            const [players, coaches, upcomingMatches, completedMatches] = await Promise.all([
                prisma.seasonClubPlayer.count({ where: { seasonClub: { clubId } } }),
                prisma.seasonClubCoach.count({ where: { seasonClub: { clubId } } }),
                prisma.match.count({ where: { OR: [{ homeClubId: clubId }, { awayClubId: clubId }], status: { in: ["scheduled", "upcoming"] } } }),
                prisma.match.count({ where: { OR: [{ homeClubId: clubId }, { awayClubId: clubId }], status: "completed" } }),
            ]);

            return success({ players, coaches, upcomingMatches, completedMatches });
        }

        if (isMEA) {
            const meaSeasonIds = auth.roles
                .filter((r) => r.roleName === "match_event_admin" && r.seasonId)
                .map((r) => r.seasonId as string);

            const [pendingApproval, liveMatches] = await Promise.all([
                prisma.match.count({ where: { seasonId: { in: meaSeasonIds }, status: { in: ["scheduled", "upcoming"] } } }),
                prisma.match.count({ where: { seasonId: { in: meaSeasonIds }, status: "live" } }),
            ]);

            return success({ pendingApproval, liveMatches });
        }

        return success({});
    } catch (error) {
        return serverError(error);
    }
}
