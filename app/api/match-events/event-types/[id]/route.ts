import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth, isAuthError } from "@/lib/auth";
import { success, badRequest, notFound, serverError } from "@/lib/api-helpers";

// PATCH /api/match-events/event-types/[id]
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

        const record = await prisma.eventType.update({
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

// DELETE /api/match-events/event-types/[id]
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

        const inUse = await prisma.matchEvent.findFirst({ where: { eventTypeId: idNum } });
        if (inUse) return badRequest("Cannot delete: event type is in use by one or more match events");

        const existing = await prisma.eventType.findUnique({ where: { id: idNum } });
        if (!existing) return notFound("Event type not found");

        await prisma.eventType.delete({ where: { id: idNum } });
        return success({ message: "Event type deleted" });
    } catch (error) {
        return serverError(error);
    }
}
