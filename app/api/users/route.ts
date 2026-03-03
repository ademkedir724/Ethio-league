import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { hashPassword, requireAuth, isAuthError } from "@/lib/auth";
import {
  success,
  created,
  badRequest,
  serverError,
} from "@/lib/api-helpers";

// GET /api/users — list all users (admin only)
export async function GET(req: NextRequest) {
  try {
    const auth = requireAuth(req, ["SUPER_ADMIN", "LEAGUE_ADMIN"]);
    if (isAuthError(auth)) return auth;

    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        avatarUrl: true,
        createdAt: true,
      },
    });
    return success(users);
  } catch (error) {
    return serverError(error);
  }
}

// POST /api/users — register a new user
export async function POST(req: NextRequest) {
  try {
    const { email, password, name, role } = await req.json();

    if (!email || !password || !name) {
      return badRequest("Email, password, and name are required");
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return badRequest("Email already in use");
    }

    const passwordHash = await hashPassword(password);

    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        name,
        role: role || "FAN",
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
      },
    });

    return created(user);
  } catch (error) {
    return serverError(error);
  }
}
