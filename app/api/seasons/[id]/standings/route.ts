import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth, isAuthError } from "@/lib/auth";
import { success, badRequest, forbidden, notFound, serverError, parseUUID } from "@/lib/api-helpers";
import { assertLeagueScope, assertOrgScope, assertMEASeasonScope, assertClubScope } from "@/lib/scope-guard";
import { computeStandings, MatchResult } from "@/lib/standings";

export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const auth = await requireAuth(req);
        if (isAuthError(auth)) return auth;

        const { id } = await params;
        const seasonId = parseUUID(id);
        if (!seasonId) return badRequest("Invalid season ID");

        const season = await prisma.season.findUnique({
            where: { id: seasonId },
            include: { league: true, seasonClubs: { select: { clubId: true } } },
        });
        if (!season) return notFound("Season not found");

        const clubAdminRole = auth.roles.find((r) => r.roleName === "club_admin");
        const isClubInSeason = clubAdminRole?.clubId
            ? season.seasonClubs.some((sc) => sc.clubId === clubAdminRole.clubId)
            : false;

        const allowed =
            assertLeagueScope(auth, season.leagueId) ||
            assertOrgScope(auth, season.league.organizationId) ||
            assertMEASeasonScope(auth, seasonId) ||
            isClubInSeason;

        if (!allowed) return forbidden();

        const matches = await prisma.match.findMany({
            where: { seasonId, status: "completed" },
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

        const standings = computeStandings(matchResults, season.pointsWin ?? 3, season.pointsDraw ?? 1);
        return success(standings);
    } catch (error) {
        return serverError(error);
    }
}
