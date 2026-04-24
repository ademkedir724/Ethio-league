import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth, isAuthError } from "@/lib/auth";
import { created, badRequest, serverError } from "@/lib/api-helpers";

// POST /api/notifications/send — send notification to user(s)
// Body: { userIds: number[], title: string, body: string }
export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuth(req, [
      "super_admin", "organization_admin", "league_admin",
    ]);
    if (isAuthError(auth)) return auth;

    const { userIds, title, body } = await req.json();

    if (!userIds || !Array.isArray(userIds) || !title || !body) {
      return badRequest("userIds (array), title, and body are required");
    }

    const data = userIds.map((userId: string) => ({
      userId,
      title,
      body,
    }));

    const result = await prisma.notification.createMany({ data });

    return created({
      message: `Sent ${result.count} notification(s)`,
      count: result.count,
    });
  } catch (error) {
    return serverError(error);
  }
}
