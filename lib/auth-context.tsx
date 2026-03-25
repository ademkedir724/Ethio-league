"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";

interface RoleScope {
  roleName: string;
  organizationId?: string | null;
  seasonId?: string | null;
  clubId?: string | null;
}

interface AuthUser {
  userId: string;
  email: string;
  fullName: string;
  roles: RoleScope[];
}

interface AuthContextType {
  user: AuthUser | null;
  token: string | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  hasRole: (roleNames: string[]) => boolean;
  isSuperAdmin: () => boolean;
  isOrgAdmin: () => boolean;
  getOrganizationId: () => string | null;
  isLeagueAdmin: () => boolean;
  isClubAdmin: () => boolean;
  isMEA: () => boolean;
  getSeasonId: () => string | null;
  getClubId: () => string | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const storedToken = localStorage.getItem("accessToken");
    const storedUser = localStorage.getItem("user");
    if (storedToken && storedUser) {
      try {
        setToken(storedToken);
        setUser(JSON.parse(storedUser));
      } catch {
        localStorage.removeItem("accessToken");
        localStorage.removeItem("refreshToken");
        localStorage.removeItem("user");
      }
    }
    setIsLoading(false);
  }, []);

  const login = useCallback(
    async (email: string, password: string) => {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Login failed");
      }

      const data = await res.json();
      const { accessToken, refreshToken, user: userData } = data;

      localStorage.setItem("accessToken", accessToken);
      localStorage.setItem("refreshToken", refreshToken);
      localStorage.setItem("user", JSON.stringify(userData));

      setToken(accessToken);
      setUser(userData);
      router.push("/dashboard");
    },
    [router]
  );

  const logout = useCallback(() => {
    localStorage.removeItem("accessToken");
    localStorage.removeItem("refreshToken");
    localStorage.removeItem("user");
    setToken(null);
    setUser(null);
    router.push("/login");
  }, [router]);

  const hasRole = useCallback(
    (roleNames: string[]) => {
      if (!user) return false;
      return user.roles.some((r) => roleNames.includes(r.roleName));
    },
    [user]
  );

  const isSuperAdmin = useCallback(() => {
    return hasRole(["super_admin"]);
  }, [hasRole]);

  const isOrgAdmin = useCallback(() => {
    return hasRole(["organization_admin"]);
  }, [hasRole]);

  const isLeagueAdmin = useCallback(() => {
    return hasRole(["league_admin"]);
  }, [hasRole]);

  const isClubAdmin = useCallback(() => {
    return hasRole(["club_admin"]);
  }, [hasRole]);

  const isMEA = useCallback(() => {
    return hasRole(["match_event_admin"]);
  }, [hasRole]);

  const getSeasonId = useCallback((): string | null => {
    if (!user) return null;
    const role = user.roles.find(
      (r) =>
        (r.roleName === "league_admin" || r.roleName === "match_event_admin") &&
        r.seasonId
    );
    return role?.seasonId || null;
  }, [user]);

  const getClubId = useCallback((): string | null => {
    if (!user) return null;
    const role = user.roles.find(
      (r) => r.roleName === "club_admin" && r.clubId
    );
    return role?.clubId || null;
  }, [user]);

  const getOrganizationId = useCallback((): string | null => {
    if (!user) return null;
    // Find the organization_admin role scope to get the organizationId
    const orgAdminRole = user.roles.find(
      (r) => r.roleName === "organization_admin" && r.organizationId
    );
    if (orgAdminRole?.organizationId) {
      return orgAdminRole.organizationId;
    }
    // Fallback: check any role with organizationId
    const anyRoleWithOrg = user.roles.find((r) => r.organizationId);
    return anyRoleWithOrg?.organizationId || null;
  }, [user]);

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isLoading,
        login,
        logout,
        hasRole,
        isSuperAdmin,
        isOrgAdmin,
        getOrganizationId,
        isLeagueAdmin,
        isClubAdmin,
        isMEA,
        getSeasonId,
        getClubId,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
