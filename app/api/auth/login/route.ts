import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import {
  verifyPassword,
  signAccessToken,
  signRefreshToken,
} from "@/lib/auth";
import { badRequest, serverError, success } from "@/lib/api-helpers";

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json();

    if (!email || !password) {
      return badRequest("Email and password are required");
    }

    const user = await prisma.user.findUnique({
      where: { email },
      include: {
        userRoleScopes: {
          include: { role: true },
        },
      },
    });
    if (!user) {
      return badRequest("Invalid email or password");
    }

    if (user.status !== "active") {
      return badRequest("Your account is not active. Please wait for approval.");
    }

    // Check if user has set a password (passwordHash is not empty)
    if (!user.passwordHash || user.passwordHash === "") {
      return badRequest("Please set your password using the link sent to your email.");
    }

    const valid = await verifyPassword(password, user.passwordHash);
    if (!valid) {
      return badRequest("Invalid email or password");
    }

    const payload = { userId: user.id, email: user.email };
    const accessToken = signAccessToken(payload);
    const refreshToken = signRefreshToken(payload);

    return success({
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        phone: user.phone,
        status: user.status,
        roles: user.userRoleScopes.map((s) => ({
          role: s.role.name,
          organizationId: s.organizationId,
          seasonId: s.seasonId,
          clubId: s.clubId,
        })),
      },
    });
  } catch (error) {
    return serverError(error);
  }
}
