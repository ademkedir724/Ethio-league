import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth, isAuthError, verifyPassword, hashPassword } from "@/lib/auth";
import { success, badRequest, serverError } from "@/lib/api-helpers";
import { logAudit } from "@/lib/audit";

// POST /api/users/me/change-password
export async function POST(req: NextRequest) {
    try {
        const auth = await requireAuth(req);
        if (isAuthError(auth)) return auth;

        const { currentPassword, newPassword, confirmPassword } = await req.json();

        if (!currentPassword || !newPassword || !confirmPassword) {
            return badRequest("All fields are required");
        }

        if (newPassword !== confirmPassword) {
            return badRequest("Passwords do not match");
        }

        if (newPassword.length < 8) {
            return badRequest("Password must be at least 8 characters");
        }

        const user = await prisma.user.findUnique({
            where: { id: auth.userId },
            select: { passwordHash: true },
        });

        if (!user) return badRequest("User not found");

        const isValid = await verifyPassword(currentPassword, user.passwordHash);
        if (!isValid) return badRequest("Current password is incorrect");

        const newPasswordHash = await hashPassword(newPassword);

        await prisma.user.update({
            where: { id: auth.userId },
            data: { passwordHash: newPasswordHash },
        });

        await logAudit({
            userId: auth.userId,
            actionType: "password_changed",
            targetId: auth.userId,
            targetType: "user",
            description: "Password changed",
        });

        return success({ message: "Password changed successfully" });
    } catch (error) {
        return serverError(error);
    }
}
