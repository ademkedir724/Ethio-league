import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import {
  verifyRefreshToken,
  signAccessToken,
  signRefreshToken,
} from "@/lib/auth";
import { badRequest, serverError, success } from "@/lib/api-helpers";

export async function POST(req: NextRequest) {
  try {
    const { refreshToken } = await req.json();

    if (!refreshToken) {
      return badRequest("Refresh token is required");
    }

    let decoded;
    try {
      decoded = verifyRefreshToken(refreshToken);
    } catch {
      return badRequest("Invalid or expired refresh token");
    }

    // Ensure user still exists
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
    });
    if (!user) {
      return badRequest("User no longer exists");
    }

    const payload = { userId: user.id, email: user.email, role: user.role };
    const newAccessToken = signAccessToken(payload);
    const newRefreshToken = signRefreshToken(payload);

    return success({
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
    });
  } catch (error) {
    return serverError(error);
  }
}
