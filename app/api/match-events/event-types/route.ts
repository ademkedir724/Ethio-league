import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth, isAuthError } from "@/lib/auth";
import { success, created, badRequest, serverError } from "@/lib/api-helpers";

// GET /api/match-events/event-types — list all event types (enum table)
export async function GET() {
  try {
    const eventTypes = await prisma.eventType.findMany({
      orderBy: { id: "asc" },
    });
    return success(eventTypes);
  } catch (error) {
    return serverError(error);
  }
}

// POST /api/match-events/event-types — create an event type
export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuth(req, ["super_admin"]);
    if (isAuthError(auth)) return auth;

    const body = await req.json();
    const { name, description } = body;

    if (!name) return badRequest("name is required");

    const record = await prisma.eventType.create({
      data: { name, description: description ?? null },
    });

    return created(record);
  } catch (error) {
    return serverError(error);
  }
}
