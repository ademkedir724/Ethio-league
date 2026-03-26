import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth, isAuthError } from "@/lib/auth";
import { success, serverError } from "@/lib/api-helpers";

// GET /api/audit-logs — super_admin only, filterable, paginated
export async function GET(req: NextRequest) {
    try {
        const auth = await requireAuth(req, ["super_admin"]);
        if (isAuthError(auth)) return auth;

        const { searchParams } = req.nextUrl;
        const actionType = searchParams.get("actionType");
        const fromDate = searchParams.get("fromDate");
        const toDate = searchParams.get("toDate");
        const userId = searchParams.get("userId");
        const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
        const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") ?? "50", 10)));

        const where: Record<string, unknown> = {};
        if (actionType) where.actionType = actionType;
        if (userId) where.userId = userId;
        if (fromDate || toDate) {
            where.timestamp = {
                ...(fromDate && { gte: new Date(fromDate) }),
                ...(toDate && { lte: new Date(toDate) }),
            };
        }

        const [total, logs] = await Promise.all([
            prisma.auditLog.count({ where }),
            prisma.auditLog.findMany({
                where,
                include: {
                    user: { select: { id: true, fullName: true, email: true } },
                },
                orderBy: { timestamp: "desc" },
                skip: (page - 1) * limit,
                take: limit,
            }),
        ]);

        return success({ total, page, limit, logs });
    } catch (error) {
        return serverError(error);
    }
}
