import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { success, badRequest, notFound, serverError, parseUUID } from "@/lib/api-helpers";

// GET /api/fan/coaches/[id]
// Public — no auth required
export async function GET(
    _req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const coachId = parseUUID(id);
        if (!coachId) return badRequest("Invalid coach ID");

        const coach = await prisma.coach.findUnique({
            where: { id: coachId },
            include: {
                images: { orderBy: { sortOrder: "asc" } },
                originClub: { select: { id: true, name: true, logoUrl: true } },
            },
        });

        if (!coach) return notFound("Coach not found");

        return success(coach);
    } catch (error) {
        return serverError(error);
    }
}

export { handleOptions as OPTIONS } from "@/lib/fan-cors";
