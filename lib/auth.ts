import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

const JWT_SECRET = process.env.JWT_SECRET || "change-me-in-production";
const JWT_REFRESH_SECRET =
  process.env.JWT_REFRESH_SECRET || "change-me-refresh-in-production";

const ACCESS_TOKEN_EXPIRES = "15m";
const REFRESH_TOKEN_EXPIRES = "7d";

// ─── Password Helpers ───────────────────────────────────────

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// ─── Token Types ────────────────────────────────────────────

export interface TokenPayload {
  userId: string;
  email: string;
}

export interface RoleScope {
  roleName: string;
  organizationId?: string | null;
  seasonId?: string | null;
  clubId?: string | null;
}

export interface AuthUser extends TokenPayload {
  roles: RoleScope[];
}

// ─── Token Helpers ──────────────────────────────────────────

export function signAccessToken(payload: TokenPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: ACCESS_TOKEN_EXPIRES });
}

export function signRefreshToken(payload: TokenPayload): string {
  return jwt.sign(payload, JWT_REFRESH_SECRET, {
    expiresIn: REFRESH_TOKEN_EXPIRES,
  });
}

export function verifyAccessToken(token: string): TokenPayload {
  return jwt.verify(token, JWT_SECRET) as TokenPayload;
}

export function verifyRefreshToken(token: string): TokenPayload {
  return jwt.verify(token, JWT_REFRESH_SECRET) as TokenPayload;
}

// ─── Request Auth Helper ────────────────────────────────────

export function getTokenFromRequest(req: NextRequest): string | null {
  const authHeader = req.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    return authHeader.slice(7);
  }
  return null;
}

/**
 * Authenticate the request and load the user's scoped roles from the DB.
 */
export async function authenticate(
  req: NextRequest
): Promise<AuthUser | null> {
  const token = getTokenFromRequest(req);
  if (!token) return null;

  try {
    const payload = verifyAccessToken(token);

    // Load scoped roles from user_role_scopes
    const scopes = await prisma.userRoleScope.findMany({
      where: { userId: payload.userId },
      include: { role: true },
    });

    const roles: RoleScope[] = scopes.map((s) => ({
      roleName: s.role.name,
      organizationId: s.organizationId,
      seasonId: s.seasonId,
      clubId: s.clubId,
    }));

    return { ...payload, roles };
  } catch {
    return null;
  }
}

// ─── Role / Scope Guards ────────────────────────────────────

/**
 * Check if a user has any of the allowed role names (system-wide check).
 */
export function hasRole(user: AuthUser, allowedRoles: string[]): boolean {
  return user.roles.some((r) => allowedRoles.includes(r.roleName));
}

/**
 * Check if a user has a specific role scoped to an organization.
 */
export function hasOrgRole(
  user: AuthUser,
  roleName: string,
  organizationId: string
): boolean {
  return user.roles.some(
    (r) => r.roleName === roleName && r.organizationId === organizationId
  );
}

/**
 * Check if a user has a specific role scoped to a season.
 */
export function hasSeasonRole(
  user: AuthUser,
  roleName: string,
  seasonId: string
): boolean {
  return user.roles.some(
    (r) => r.roleName === roleName && r.seasonId === seasonId
  );
}

/**
 * Check if a user has a specific role scoped to a club.
 */
export function hasClubRole(
  user: AuthUser,
  roleName: string,
  clubId: string
): boolean {
  return user.roles.some(
    (r) => r.roleName === roleName && r.clubId === clubId
  );
}

/**
 * Require authentication. Returns the AuthUser or a 401/403 NextResponse.
 * Optionally pass allowedRoles for a system-wide role check.
 */
export async function requireAuth(
  req: NextRequest,
  allowedRoles?: string[]
): Promise<AuthUser | NextResponse> {
  const user = await authenticate(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (allowedRoles && !hasRole(user, allowedRoles)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return user;
}

/**
 * Type guard to check if requireAuth returned an error response.
 */
export function isAuthError(
  result: AuthUser | NextResponse
): result is NextResponse {
  return result instanceof NextResponse;
}
