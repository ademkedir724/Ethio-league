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
  leagueId?: string | null;
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
  getLeagueId: () => string | null;
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
    const storedRefreshToken = localStorage.getItem("refreshToken");
    const storedUser = localStorage.getItem("user");

    if (!storedToken || !storedUser) {
      setIsLoading(false);
      return;
    }

    // Check if the access token is expired or close to expiry (within 5 min)
    const isTokenExpiredOrSoon = (token: string): boolean => {
      try {
        const payload = JSON.parse(atob(token.split(".")[1]));
        const expiresAt = payload.exp * 1000;
        return Date.now() >= expiresAt - 5 * 60 * 1000;
      } catch {
        return true;
      }
    };

    const initAuth = async () => {
      try {
        if (isTokenExpiredOrSoon(storedToken) && storedRefreshToken) {
          // Proactively refresh before setting state
          const refreshRes = await fetch("/api/auth/refresh-token", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ refreshToken: storedRefreshToken }),
          });

          if (refreshRes.ok) {
            const data = await refreshRes.json();
            localStorage.setItem("accessToken", data.accessToken);
            if (data.refreshToken) {
              localStorage.setItem("refreshToken", data.refreshToken);
            }
            setToken(data.accessToken);
          } else {
            // Refresh failed — clear everything
            localStorage.removeItem("accessToken");
            localStorage.removeItem("refreshToken");
            localStorage.removeItem("user");
            setIsLoading(false);
            return;
          }
        } else {
          setToken(storedToken);
        }

        setUser(JSON.parse(storedUser));
      } catch {
        localStorage.removeItem("accessToken");
        localStorage.removeItem("refreshToken");
        localStorage.removeItem("user");
      } finally {
        setIsLoading(false);
      }
    };

    initAuth();
  }, []);

  // Proactively refresh the access token every 7 hours while the tab is open
  useEffect(() => {
    if (!token) return;

    const REFRESH_INTERVAL = 7 * 60 * 60 * 1000; // 7 hours

    const interval = setInterval(async () => {
      const refreshToken = localStorage.getItem("refreshToken");
      if (!refreshToken) return;

      try {
        const res = await fetch("/api/auth/refresh-token", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refreshToken }),
        });

        if (res.ok) {
          const data = await res.json();
          localStorage.setItem("accessToken", data.accessToken);
          if (data.refreshToken) {
            localStorage.setItem("refreshToken", data.refreshToken);
          }
          setToken(data.accessToken);
        }
        // If refresh fails, let the next API call handle the 401 naturally
      } catch {
        // Network error — don't log out, just wait for next interval
      }
    }, REFRESH_INTERVAL);

    return () => clearInterval(interval);
  }, [token]);

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

  const getLeagueId = useCallback((): string | null => {
    if (!user) return null;
    const role = user.roles.find(
      (r) => r.roleName === "league_admin" && r.leagueId
    );
    return role?.leagueId || null;
  }, [user]);

  const getSeasonId = useCallback((): string | null => {
    if (!user) return null;
    // Only match_event_admin uses seasonId scope now
    const role = user.roles.find(
      (r) => r.roleName === "match_event_admin" && r.seasonId
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
        getLeagueId,
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
