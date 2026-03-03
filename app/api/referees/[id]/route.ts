import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth, isAuthError } from "@/lib/auth";
import { success, badRequest, notFound, serverError, parseId } from "@/lib/api-helpers";

// GET /api/referees/:id
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth(req);
    if (isAuthError(auth)) return auth;

    const { id: idStr } = await params;
    const id = parseId({ id: idStr });
    if (!id) return badRequest("Invalid referee ID");

    const referee = await prisma.referee.findUnique({
      where: { id },
      include: {
        refereeLeagues: {
          include: {
            season: { select: { id: true, name: true, leagueName: true } },
          },
        },
        matchReferees: {
          include: {
            match: {
              select: {
                id: true,
                matchDate: true,
                homeClub: { select: { name: true } },
                awayClub: { select: { name: true } },
              },
            },
          },
        },
      },
    });

    if (!referee) return notFound("Referee not found");
    return success(referee);
  } catch (error) {
    return serverError(error);
  }
}

// PATCH /api/referees/:id
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth(req, [
      "super_admin", "organization_admin", "league_admin",
    ]);
    if (isAuthError(auth)) return auth;

    const { id: idStr } = await params;
    const id = parseId({ id: idStr });
    if (!id) return badRequest("Invalid referee ID");

    const data = await req.json();
    const allowedFields = [
      "firstName", "lastName", "dateOfBirth", "nationality",
      "licenseLevel", "experienceYears", "photoUrl", "status",
    ];
    const updateData: Record<string, unknown> = {};
    for (const field of allowedFields) {
      if (data[field] !== undefined) {
        if (field === "dateOfBirth") {
          updateData[field] = new Date(data[field]);
        } else {
          updateData[field] = data[field];
        }
      }
    }

    const referee = await prisma.referee.update({
      where: { id },
      data: updateData,
    });

    return success(referee);
  } catch (error) {
    return serverError(error);
  }
}
