import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth, isAuthError } from "@/lib/auth";
import { success, notFound, serverError } from "@/lib/api-helpers";
import { logAudit } from "@/lib/audit";

// GET /api/users/me
export async function GET(req: NextRequest) {
    try {
        const auth = await requireAuth(req);
        if (isAuthError(auth)) return auth;

        const user = await prisma.user.findUnique({
            where: { id: auth.userId },
            include: { userRoleScopes: { include: { role: true } } },
        });

        if (!user) return notFound("User not found");

        const { passwordHash: _omit, ...rest } = user;
        return success({
            id: rest.id,
            fullName: rest.fullName,
            email: rest.email,
            phone: rest.phone,
            status: rest.status,
            roles: rest.userRoleScopes,
        });
    } catch (error) {
        return serverError(error);
    }
}

// PATCH /api/users/me
export async function PATCH(req: NextRequest) {
    try {
        const auth = await requireAuth(req);
        if (isAuthError(auth)) return auth;

        const { fullName, phone } = await req.json();

        const user = await prisma.user.update({
            where: { id: auth.userId },
            data: { fullName, phone },
            include: { userRoleScopes: { include: { role: true } } },
        });

        await logAudit({
            userId: auth.userId,
            actionType: "profile_updated",
            targetId: auth.userId,
            targetType: "user",
            description: "Profile updated",
        });

        const { passwordHash: _omit, ...rest } = user;
        return success({
            id: rest.id,
            fullName: rest.fullName,
            email: rest.email,
            phone: rest.phone,
            status: rest.status,
            roles: rest.userRoleScopes,
        });
    } catch (error) {
        return serverError(error);
    }
}
