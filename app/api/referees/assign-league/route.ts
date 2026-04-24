import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth, isAuthError } from "@/lib/auth";
import { success, created, badRequest, serverError } from "@/lib/api-helpers";

// POST /api/referees/assign-league — assign referee to a season (Org Admin)
// Body: { refereeId, seasonId, roleLevel? }
export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuth(req, ["super_admin", "organization_admin"]);
    if (isAuthError(auth)) return auth;

    const { refereeId, seasonId, roleLevel } = await req.json();

    if (!refereeId || !seasonId) {
      return badRequest("refereeId and seasonId are required");
    }

    const existing = await prisma.seasonReferee.findUnique({
      where: { refereeId_seasonId: { refereeId, seasonId } },
    });
    if (existing) return badRequest("Referee already assigned to this season");

    const sr = await prisma.seasonReferee.create({
      data: {
        refereeId,
        seasonId,
        roleLevel: roleLevel || "main_referee",
        approvedDate: new Date(),
      },
      include: {
        referee: true,
        season: { select: { id: true, name: true, leagueId: true } },
      },
    });

    return created(sr);
  } catch (error) {
    return serverError(error);
  }
}
