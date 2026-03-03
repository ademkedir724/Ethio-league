import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { hashPassword, requireAuth, isAuthError } from "@/lib/auth";
import {
  success,
  created,
  badRequest,
  serverError,
} from "@/lib/api-helpers";

// GET /api/users — list all users (super_admin or organization_admin)
export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuth(req, ["super_admin", "organization_admin"]);
    if (isAuthError(auth)) return auth;

    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        fullName: true,
        phone: true,
        status: true,
        createdAt: true,
        userRoleScopes: {
          include: { role: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });
    return success(users);
  } catch (error) {
    return serverError(error);
  }
}

// POST /api/users — register a new user (public registration)
export async function POST(req: NextRequest) {
  try {
    const { email, password, fullName, phone } = await req.json();

    if (!email || !password || !fullName) {
      return badRequest("Email, password, and fullName are required");
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return badRequest("Email already in use");
    }

    const passwordHash = await hashPassword(password);

    // Create user and assign default "fan" role
    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        fullName,
        phone,
      },
      select: {
        id: true,
        email: true,
        fullName: true,
        phone: true,
        status: true,
        createdAt: true,
      },
    });

    // Assign default fan role
    const fanRole = await prisma.role.findUnique({ where: { name: "fan" } });
    if (fanRole) {
      await prisma.userRoleScope.create({
        data: {
          userId: user.id,
          roleId: fanRole.id,
        },
      });
    }

    return created(user);
  } catch (error) {
    return serverError(error);
  }
}
