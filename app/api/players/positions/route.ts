import prisma from "@/lib/prisma";
import { success, serverError } from "@/lib/api-helpers";

// GET /api/players/positions — list all player positions (enum table)
export async function GET() {
  try {
    const positions = await prisma.position.findMany({
      orderBy: { id: "asc" },
    });
    return success(positions);
  } catch (error) {
    return serverError(error);
  }
}
