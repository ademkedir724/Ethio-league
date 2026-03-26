import type { AuthUser } from "@/lib/auth";

export function makeSuperAdmin(): AuthUser {
    return {
        userId: "super-admin-id",
        email: "admin@test.com",
        roles: [{ roleName: "super_admin" }],
    };
}

export function makeOrgAdmin(organizationId: string): AuthUser {
    return {
        userId: "org-admin-id",
        email: "orgadmin@test.com",
        roles: [{ roleName: "organization_admin", organizationId }],
    };
}

export function makeLeagueAdmin(seasonId: string): AuthUser {
    return {
        userId: "league-admin-id",
        email: "leagueadmin@test.com",
        roles: [{ roleName: "league_admin", seasonId }],
    };
}

export function makeClubAdmin(clubId: string): AuthUser {
    return {
        userId: "club-admin-id",
        email: "clubadmin@test.com",
        roles: [{ roleName: "club_admin", clubId }],
    };
}

export function makeMEA(seasonId: string): AuthUser {
    return {
        userId: "mea-id",
        email: "mea@test.com",
        roles: [{ roleName: "match_event_admin", seasonId }],
    };
}
