import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { success, badRequest, serverError } from "@/lib/api-helpers";
import { sendPasswordResetEmail } from "@/lib/email";
import crypto from "crypto";

// POST /api/auth/forgot-password
// Body: { email }
// Always returns success to avoid email enumeration
export async function POST(req: NextRequest) {
    try {
        const { email } = await req.json();
        if (!email || typeof email !== "string") return badRequest("Email is required");

        const user = await prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } });

        if (user) {
            const token = crypto.randomBytes(32).toString("hex");
            const expires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

            await prisma.user.update({
                where: { id: user.id },
                data: { passwordResetToken: token, passwordResetExpires: expires },
            });

            // Fire-and-forget — don't block the response on email delivery
            sendPasswordResetEmail(user.email, token).catch((err) =>
                console.error("[email] Failed to send password reset email:", err)
            );
        }

        // Always return the same response regardless of whether the user exists
        return success({ message: "If that email is registered, a reset link has been sent." });
    } catch (error) {
        return serverError(error);
    }
}
