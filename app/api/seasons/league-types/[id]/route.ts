import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth, isAuthError } from "@/lib/auth";
import { success, badRequest, notFound, serverError } from "@/lib/api-helpers";

// PATCH /api/seasons/league-types/[id]
export async function PATCH(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const auth = await requireAuth(req, ["super_admin"]);
        if (isAuthError(auth)) return auth;

        const { id } = await params;
        const idNum = parseInt(id, 10);
        if (isNaN(idNum)) return badRequest("Invalid ID");

        const body = await req.json();
        const { name, description } = body;

        const record = await prisma.leagueType.update({
            where: { id: idNum },
            data: {
                ...(name !== undefined && { name }),
                ...(description !== undefined && { description }),
            },
        });

        return success(record);
    } catch (error) {
        return serverError(error);
    }
}

// DELETE /api/seasons/league-types/[id]
export async function DELETE(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const auth = await requireAuth(req, ["super_admin"]);
        if (isAuthError(auth)) return auth;

        const { id } = await params;
        const idNum = parseInt(id, 10);
        if (isNaN(idNum)) return badRequest("Invalid ID");

        const inUse = await prisma.league.findFirst({ where: { leagueTypeId: idNum } });
        if (inUse) return badRequest("Cannot delete: league type is in use by one or more leagues");

        const existing = await prisma.leagueType.findUnique({ where: { id: idNum } });
        if (!existing) return notFound("League type not found");

        await prisma.leagueType.delete({ where: { id: idNum } });
        return success({ message: "League type deleted" });
    } catch (error) {
        return serverError(error);
    }
}
