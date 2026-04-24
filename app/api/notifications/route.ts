import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth, isAuthError } from "@/lib/auth";
import { success, serverError } from "@/lib/api-helpers";

// GET /api/notifications — get current user's notifications
export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuth(req);
    if (isAuthError(auth)) return auth;

    const notifications = await prisma.notification.findMany({
      where: { userId: auth.userId },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    return success(notifications);
  } catch (error) {
    return serverError(error);
  }
}

// PATCH /api/notifications — mark notifications as read
// Body: { ids: number[] } or { all: true }
export async function PATCH(req: NextRequest) {
  try {
    const auth = await requireAuth(req);
    if (isAuthError(auth)) return auth;

    const body = await req.json();

    if (body.all) {
      await prisma.notification.updateMany({
        where: { userId: auth.userId, read: false },
        data: { read: true },
      });
    } else if (Array.isArray(body.ids)) {
      await prisma.notification.updateMany({
        where: { id: { in: body.ids }, userId: auth.userId },
        data: { read: true },
      });
    }

    return success({ message: "Notifications updated" });
  } catch (error) {
    return serverError(error);
  }
}
