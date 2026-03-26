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

            const meaRoleId = await prisma.role.findUnique({ where: { name: "match_event_admin" }, select: { id: true } });

            const [totalLeagues, activeLeagues, totalClubs, pendingClubs, totalReferees, totalMatchEventAdmins, upcomingMatches] = await Promise.all([
                prisma.league.count({ where: { organizationId: orgId } }),
                prisma.league.count({ where: { organizationId: orgId, status: "active" } }),
                prisma.club.count({ where: { seasonClubs: { some: { season: { league: { organizationId: orgId } } } } } }),
                prisma.club.count({ where: { status: "pending", seasonClubs: { some: { season: { league: { organizationId: orgId } } } } } }),
                prisma.referee.count({ where: { seasonReferees: { some: { season: { league: { organizationId: orgId } } } } } }),
                meaRoleId ? prisma.userRoleScope.count({ where: { roleId: meaRoleId.id, organizationId: orgId } }) : Promise.resolve(0),
                prisma.match.count({ where: { season: { league: { organizationId: orgId } }, status: { in: ["scheduled", "upcoming"] } } }),
            ]);

            return success({ totalLeagues, activeLeagues, totalClubs, pendingClubs, totalReferees, totalMatchEventAdmins, upcomingMatches });
        }

        if (isLeagueAdmin) {
            const leagueId = auth.roles.find((r) => r.roleName === "league_admin")?.leagueId;
            if (!leagueId) return success({});

            const [totalSeasons, clubs, totalMatches, completedMatches, liveMatches, upcomingMatches] = await Promise.all([
                prisma.season.count({ where: { leagueId } }),
                prisma.seasonClub.count({ where: { season: { leagueId } } }),
                prisma.match.count({ where: { season: { leagueId } } }),
                prisma.match.count({ where: { season: { leagueId }, status: "completed" } }),
                prisma.match.count({ where: { season: { leagueId }, status: "live" } }),
                prisma.match.count({ where: { season: { leagueId }, status: { in: ["scheduled", "upcoming"] } } }),
            ]);

            return success({ totalSeasons, clubs, totalMatches, completedMatches, liveMatches, upcomingMatches });
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
