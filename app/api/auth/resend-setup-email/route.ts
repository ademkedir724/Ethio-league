import { NextRequest } from "next/server";
import crypto from "crypto";
import prisma from "@/lib/prisma";
import { requireAuth, isAuthError } from "@/lib/auth";
import { success, badRequest, notFound } from "@/lib/api-helpers";
import { sendPasswordSetupEmail, getAppUrl } from "@/lib/email";
import { logAudit } from "@/lib/audit";

const ALLOWED_ROLES = ["super_admin", "organization_admin", "league_admin"];

// POST /api/auth/resend-setup-email — resend password setup email
export async function POST(req: NextRequest) {
    try {
        const auth = await requireAuth(req, ALLOWED_ROLES);
        if (isAuthError(auth)) return auth;

        const { email } = await req.json();
        if (!email) {
            return badRequest("Email is required");
        }

        const user = await prisma.user.findUnique({ where: { email } });
        if (!user) {
            return notFound("User not found");
        }

        const token = crypto.randomBytes(32).toString("hex");

        await prisma.user.update({
            where: { id: user.id },
            data: {
                passwordResetToken: token,
                passwordResetExpires: new Date(Date.now() + 3600000),
            },
        });

        const appUrl = getAppUrl(req);
        const setupLink = `${appUrl}/set-password?token=${token}`;

        let emailSent = true;
        try {
            await sendPasswordSetupEmail(email, token, req);
        } catch (emailError) {
            emailSent = false;
            console.error("Failed to send password setup email:", emailError);
            await logAudit({
                userId: auth.userId,
                actionType: "email_failure",
                targetId: user.id,
                targetType: "user",
                description: `Failed to resend password setup email to ${email}: ${String(emailError)}`,
            });
            // Do NOT return serverError — the token was saved; return the link as fallback
        }

        await logAudit({
            userId: auth.userId,
            actionType: "resend_setup_email",
            targetId: user.id,
            targetType: "user",
            description: "Password setup email resent",
        });

        return success({
            message: emailSent ? "Password setup email sent" : "Email delivery failed — use the setup link below",
            setupLink,
        });
    } catch (error) {
        return serverError(error);
    }
}
