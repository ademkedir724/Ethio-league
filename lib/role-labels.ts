/**
 * Maps internal role name strings (as stored in the DB) to
 * user-facing display labels shown in the UI.
 *
 * Internal names are never changed — only what users see changes here.
 */
export const ROLE_LABELS: Record<string, string> = {
    super_admin: "Platform Admin",
    organization_admin: "Federation Admin",
    league_admin: "League Manager",
    club_admin: "Club Manager",
    match_event_admin: "Match Recorder",
    fan: "Supporter",
};

/** Returns the display label for a role, falling back to a formatted version of the raw name. */
export function getRoleLabel(roleName: string): string {
    // Support both "super_admin" and "SUPER_ADMIN" formats
    const key = roleName.toLowerCase();
    return (
        ROLE_LABELS[key] ??
        roleName
            .split("_")
            .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
            .join(" ")
    );
}
