import prisma from "@/lib/prisma";
import { success, serverError } from "@/lib/api-helpers";

// GET /api/users/roles — list all available roles from DB
export async function GET() {
  try {
    const roles = await prisma.role.findMany({
      orderBy: { id: "asc" },
    });
    return success(roles);
  } catch (error) {
    return serverError(error);
  }
}
