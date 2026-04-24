import { AuthUser } from "@/lib/auth";

/**
 * Returns true if the user is super_admin OR has organization_admin role
 * scoped to the given organizationId.
 */
export function assertOrgScope(auth: AuthUser, organizationId: string): boolean {
    return auth.roles.some(
        (r) =>
            r.roleName === "super_admin" ||
            (r.roleName === "organization_admin" && r.organizationId === organizationId)
    );
}

/**
 * Returns true if the user is super_admin OR has league_admin role
 * scoped to the given leagueId.
 */
export function assertLeagueScope(auth: AuthUser, leagueId: string): boolean {
    return auth.roles.some(
        (r) =>
            r.roleName === "super_admin" ||
            (r.roleName === "league_admin" && r.leagueId === leagueId)
    );
}

/**
 * Returns true if the user is super_admin, OR has league_admin scoped to the
 * league that owns this season (seasonLeagueId), OR has organization_admin
 * scoped to the org that owns the league.
 *
 * API routes must fetch the season first to obtain seasonLeagueId before calling this.
 */
export function assertSeasonScope(
    auth: AuthUser,
    seasonLeagueId: string
): boolean {
    return auth.roles.some(
        (r) =>
            r.roleName === "super_admin" ||
            (r.roleName === "league_admin" && r.leagueId === seasonLeagueId)
    );
}

/**
 * Returns true if the user is super_admin OR has club_admin role
 * scoped to the given clubId.
 */
export function assertClubScope(auth: AuthUser, clubId: string): boolean {
    return auth.roles.some(
        (r) =>
            r.roleName === "super_admin" ||
            (r.roleName === "club_admin" && r.clubId === clubId)
    );
}

/**
 * Returns true if the user is super_admin OR league_admin (any league) OR
 * has match_event_admin role scoped to the given seasonId.
 */
export function assertMEASeasonScope(
    auth: AuthUser,
    seasonId: string
): boolean {
    return auth.roles.some(
        (r) =>
            r.roleName === "super_admin" ||
            r.roleName === "league_admin" ||
            (r.roleName === "match_event_admin" && r.seasonId === seasonId)
    );
}
