import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { badRequest, success, serverError } from "@/lib/api-helpers";

// POST /api/auth/validate-token — validate a password reset token
export async function POST(req: NextRequest) {
  try {
    const { token } = await req.json();

    if (!token) {
      return badRequest("Token is required");
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

    // Token is valid
    return success({
      valid: true,
      email: user.email,
    });
  } catch (error) {
    return serverError(error);
  }
}
