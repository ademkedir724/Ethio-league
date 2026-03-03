import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth, isAuthError } from "@/lib/auth";
import { success, created, badRequest, serverError } from "@/lib/api-helpers";

// POST /api/matches/assign-referee — assign a referee to a match
// Body: { matchId, refereeId, role }
export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuth(req, [
      "super_admin", "organization_admin", "league_admin",
    ]);
    if (isAuthError(auth)) return auth;

    const { matchId, refereeId, role } = await req.json();

    if (!matchId || !refereeId || !role) {
      return badRequest("matchId, refereeId, and role are required");
    }

    const validRoles = ["main_referee", "assistant_referee", "fourth_official", "var"];
    if (!validRoles.includes(role)) {
      return badRequest(`role must be one of: ${validRoles.join(", ")}`);
    }

    const existing = await prisma.matchReferee.findUnique({
      where: { matchId_refereeId: { matchId, refereeId } },
    });
    if (existing) return badRequest("Referee already assigned to this match");

    const mr = await prisma.matchReferee.create({
      data: { matchId, refereeId, role },
      include: {
        referee: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    return created(mr);
  } catch (error) {
    return serverError(error);
  }
}
