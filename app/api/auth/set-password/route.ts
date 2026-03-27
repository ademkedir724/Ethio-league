import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { hashPassword } from "@/lib/auth";
import { badRequest, success, serverError } from "@/lib/api-helpers";

// POST /api/auth/set-password — set password using a valid reset token
export async function POST(req: NextRequest) {
  try {
    const { token, password } = await req.json();

    if (!token) {
      return badRequest("Token is required");
    }

    if (!password) {
      return badRequest("Password is required");
    }

    if (password.length < 8) {
      return badRequest("Password must be at least 8 characters long");
    }

    // Find user with this token
    const user = await prisma.user.findFirst({
      where: {
        passwordResetToken: token,
      },
    });

    if (!user) {
      return badRequest("Invalid token");
    }

    // Check if token has expired
    if (!user.passwordResetExpires) {
      return badRequest("Invalid token");
    }

    if (new Date() > user.passwordResetExpires) {
      return badRequest("Token has expired. Please request a new password reset link.");
    }

    // Hash the new password
    const passwordHash = await hashPassword(password);

    // Update user with new password, clear reset token, and activate
    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        status: "active",
        passwordResetToken: null,
        passwordResetExpires: null,
      },
    });

    return success({
      message: "Password set successfully",
    });
  } catch (error) {
    return serverError(error);
  }
}
