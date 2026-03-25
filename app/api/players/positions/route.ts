import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth, isAuthError } from "@/lib/auth";
import { success, created, badRequest, serverError } from "@/lib/api-helpers";

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

// POST /api/players/positions — create a position
export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuth(req, ["super_admin"]);
    if (isAuthError(auth)) return auth;

    const body = await req.json();
    const { code, name } = body;

    if (!code) return badRequest("code is required");
    if (!name) return badRequest("name is required");

    const record = await prisma.position.create({
      data: { code, name },
    });

    return created(record);
  } catch (error) {
    return serverError(error);
  }
}
