import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth, isAuthError } from "@/lib/auth";
import { success, badRequest, notFound, serverError } from "@/lib/api-helpers";

// PATCH /api/players/positions/[id]
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
        const { code, name, description } = body;

        const record = await prisma.position.update({
            where: { id: idNum },
            data: {
                ...(code !== undefined && { code }),
                ...(name !== undefined && { name }),
                ...(description !== undefined && { description }),
            },
        });

        return success(record);
    } catch (error) {
        return serverError(error);
    }
}

// DELETE /api/players/positions/[id]
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

        const inUsePlayer = await prisma.player.findFirst({ where: { primaryPositionId: idNum } });
        if (inUsePlayer) return badRequest("Cannot delete: position is in use by one or more players");

        const inUseSCP = await prisma.seasonClubPlayer.findFirst({ where: { positionId: idNum } });
        if (inUseSCP) return badRequest("Cannot delete: position is in use by one or more season squad entries");

        const existing = await prisma.position.findUnique({ where: { id: idNum } });
        if (!existing) return notFound("Position not found");

        await prisma.position.delete({ where: { id: idNum } });
        return success({ message: "Position deleted" });
    } catch (error) {
        return serverError(error);
    }
}
