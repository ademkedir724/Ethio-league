import prisma from "@/lib/prisma";
import { success, serverError } from "@/lib/api-helpers";

// GET /api/seasons/league-types — list all league types (enum table)
export async function GET() {
  try {
    const leagueTypes = await prisma.leagueType.findMany({
      orderBy: { id: "asc" },
    });
    return success(leagueTypes);
  } catch (error) {
    return serverError(error);
  }
}
