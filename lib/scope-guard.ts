import { AuthUser } from "@/lib/auth";

/**
 * Returns true if the user is super_admin OR has organization_admin role
 * scoped to the given organizationId.
 */
export function assertOrgScope(
    auth: AuthUser,
    organizationId: string
): boolean {
    return auth.roles.some(
        (r) =>
            r.roleName === "super_admin" ||
            (r.roleName === "organization_admin" &&
                r.organizationId === organizationId)
    );
}

/**
 * Returns true if the user is super_admin OR has league_admin role
 * scoped to the given seasonId.
 */
export function assertSeasonScope(
    auth: AuthUser,
    seasonId: string
): boolean {
    return auth.roles.some(
        (r) =>
            r.roleName === "super_admin" ||
            (r.roleName === "league_admin" && r.seasonId === seasonId)
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
 * Returns true if the user is super_admin OR league_admin (any season) OR
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
