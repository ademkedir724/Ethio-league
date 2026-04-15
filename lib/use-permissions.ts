"use client";

import { useAuth } from "./auth-context";

// Define which pages each role can manage (create/edit/delete)
const ROLE_PERMISSIONS = {
  super_admin: ["organizations", "users"],
  organization_admin: [
    "leagues",
    "seasons",
    "clubs",
    "referees",
    "notifications",
    "users", // Can create Match Event Admins only
  ],
  league_admin: ["matches", "notifications", "seasons"],
  club_admin: ["players", "coaches"],
  match_event_admin: ["matches"],
} as const;

// Pages that are view-only for super_admin
const SUPER_ADMIN_VIEW_ONLY = [
  "clubs",
  "players",
  "coaches",
  "referees",
  "seasons",
  "leagues",
  "matches",
  "notifications",
] as const;

// Pages that are view-only for organization_admin
const ORG_ADMIN_VIEW_ONLY = [
  "players",
  "coaches",
  "matches",
] as const;

// Nav items hidden for all roles (seasons accessed via Leagues page)
export const HIDDEN_NAV_FOR_ALL = ["seasons"] as const;

// Nav items hidden specifically for club_admin
const CLUB_ADMIN_HIDDEN_NAV = ["users", "organizations", "referees"] as const;

// Nav items visible for match_event_admin (allowlist — everything else is hidden)
const MEA_VISIBLE_NAV = ["overview", "matches", "notifications", "profile"] as const;

export type ManageableResource =
  | "organizations"
  | "users"
  | "clubs"
  | "players"
  | "coaches"
  | "referees"
  | "seasons"
  | "leagues"
  | "matches"
  | "notifications";

export function usePermissions() {
  const { user, hasRole, isSuperAdmin, isOrgAdmin, getOrganizationId } = useAuth();

  /**
   * Check if the current user can manage (create/edit/delete) a resource
   */
  const canManage = (resource: ManageableResource): boolean => {
    if (!user) return false;

    // Super admin has limited write access - only to organizations and users
    if (hasRole(["super_admin"])) {
      return ROLE_PERMISSIONS.super_admin.includes(
        resource as "organizations" | "users"
      );
    }

    // Organization admin permissions
    if (hasRole(["organization_admin"])) {
      return (
        ROLE_PERMISSIONS.organization_admin as readonly string[]
      ).includes(resource);
    }

    // Check other roles
    const userRoles = user.roles.map((r) => r.roleName);

    for (const role of userRoles) {
      const permissions =
        ROLE_PERMISSIONS[role as keyof typeof ROLE_PERMISSIONS];
      if (permissions && (permissions as readonly string[]).includes(resource)) {
        return true;
      }
    }

    return false;
  };

  /**
   * Check if the resource is view-only for the current user
   */
  const isViewOnly = (resource: ManageableResource): boolean => {
    if (!user) return true;

    // Super admin has view-only access to most resources
    if (hasRole(["super_admin"])) {
      return (SUPER_ADMIN_VIEW_ONLY as readonly string[]).includes(resource);
    }

    // Organization admin has view-only access to players, coaches, matches
    if (hasRole(["organization_admin"])) {
      return (ORG_ADMIN_VIEW_ONLY as readonly string[]).includes(resource);
    }

    // For other users, check if they can manage
    return !canManage(resource);
  };

  /**
   * Check if a nav item should be visible for the current user
   */
  const canViewNavItem = (navHref: string): boolean => {
    if (!user) return false;

    const navKey = navHref.replace("/dashboard/", "").replace("/dashboard", "overview");

    // All roles: hide standalone seasons page (seasons accessed via Leagues)
    if ((HIDDEN_NAV_FOR_ALL as readonly string[]).includes(navKey)) {
      return false;
    }

    // Club admin: hide users, organizations, referees
    if (hasRole(["club_admin"]) && (CLUB_ADMIN_HIDDEN_NAV as readonly string[]).includes(navKey)) {
      return false;
    }

    // Match event admin: allowlist — only show overview, matches, notifications, profile
    if (hasRole(["match_event_admin"]) && !(MEA_VISIBLE_NAV as readonly string[]).includes(navKey)) {
      return false;
    }

    return true;
  };

  /**
   * Get the organization ID scope for the current user
   * Used for filtering data in API calls
   */
  const getOrganizationScope = (): string | null => {
    return getOrganizationId();
  };

  return {
    canManage,
    isSuperAdmin,
    isOrgAdmin,
    isViewOnly,
    canViewNavItem,
    getOrganizationScope,
  };
}
