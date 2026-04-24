import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth, isAuthError } from "@/lib/auth";
import { success, created, badRequest, serverError } from "@/lib/api-helpers";

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

// POST /api/seasons/league-types — create a league type
export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuth(req, ["super_admin"]);
    if (isAuthError(auth)) return auth;

    const body = await req.json();
    const { name, description } = body;

    if (!name) return badRequest("name is required");

    const record = await prisma.leagueType.create({
      data: { name, description: description ?? null },
    });

    return created(record);
  } catch (error) {
    return serverError(error);
  }
}
