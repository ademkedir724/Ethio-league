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

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return badRequest("Invalid email or password");
    }

    const valid = await verifyPassword(password, user.passwordHash);
    if (!valid) {
      return badRequest("Invalid email or password");
    }

    const payload = { userId: user.id, email: user.email, role: user.role };
    const accessToken = signAccessToken(payload);
    const refreshToken = signRefreshToken(payload);

    return success({
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
    });
  } catch (error) {
    return serverError(error);
  }
}
