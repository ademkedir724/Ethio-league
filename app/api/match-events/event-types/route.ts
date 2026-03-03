import prisma from "@/lib/prisma";
import { success, serverError } from "@/lib/api-helpers";

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
