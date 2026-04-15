import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { success, badRequest, serverError } from "@/lib/api-helpers";
import { hashPassword } from "@/lib/auth";

// POST /api/auth/reset-password
// Body: { token, password }
export async function POST(req: NextRequest) {
    try {
        const { token, password } = await req.json();
        if (!token || !password) return badRequest("Token and password are required");
        if (password.length < 8) return badRequest("Password must be at least 8 characters");

        const user = await prisma.user.findFirst({
            where: {
                passwordResetToken: token,
                passwordResetExpires: { gt: new Date() },
            },
        });

        if (!user) return badRequest("Reset link is invalid or has expired");

        const passwordHash = await hashPassword(password);

        await prisma.user.update({
            where: { id: user.id },
            data: {
                passwordHash,
                passwordResetToken: null,
                passwordResetExpires: null,
            },
        });

        return success({ message: "Password reset successfully. You can now log in." });
    } catch (error) {
        return serverError(error);
    }
}
