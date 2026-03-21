"use client";

import { useAuth } from "./auth-context";

// Define which pages each role can manage (create/edit/delete)
const ROLE_PERMISSIONS = {
  super_admin: ["organizations", "users"],
  organization_admin: ["seasons", "clubs", "players", "coaches", "referees", "matches", "notifications"],
  league_admin: ["matches", "notifications"],
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
  "matches",
  "notifications",
] as const;

export type ManageableResource = 
  | "organizations" 
  | "users" 
  | "clubs" 
  | "players" 
  | "coaches" 
  | "referees" 
  | "seasons" 
  | "matches" 
  | "notifications";

export function usePermissions() {
  const { user, hasRole } = useAuth();

  /**
   * Check if the current user can manage (create/edit/delete) a resource
   */
  const canManage = (resource: ManageableResource): boolean => {
    if (!user) return false;

    // Super admin has limited write access - only to organizations and users
    if (hasRole(["super_admin"])) {
      return ROLE_PERMISSIONS.super_admin.includes(resource as "organizations" | "users");
    }

    // Check other roles
    const userRoles = user.roles.map((r) => r.roleName);
    
    for (const role of userRoles) {
      const permissions = ROLE_PERMISSIONS[role as keyof typeof ROLE_PERMISSIONS];
      if (permissions && (permissions as readonly string[]).includes(resource)) {
        return true;
      }
    }

    return false;
  };

  /**
   * Check if the current user is a super admin
   */
  const isSuperAdmin = (): boolean => {
    return hasRole(["super_admin"]);
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

    // For other users, check if they can manage
    return !canManage(resource);
  };

  return {
    canManage,
    isSuperAdmin,
    isViewOnly,
  };
}
