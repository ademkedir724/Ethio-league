import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth, isAuthError } from "@/lib/auth";
import { success, badRequest, serverError, parseId } from "@/lib/api-helpers";

// PATCH /api/match-events/event-types/:id
export async function PATCH(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const auth = await requireAuth(req, ["super_admin"]);
        if (isAuthError(auth)) return auth;

        const { id: idStr } = await params;
        const id = parseId({ id: idStr });
        if (!id) return badRequest("Invalid event type ID");

        const body = await req.json();
        const updateData: Record<string, unknown> = {};
        if (body.name !== undefined) updateData.name = body.name;
        if (body.description !== undefined) updateData.description = body.description;

        const record = await prisma.eventType.update({
            where: { id },
            data: updateData,
        });

        return success(record);
    } catch (error) {
        return serverError(error);
    }
}

// DELETE /api/match-events/event-types/:id
export async function DELETE(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const auth = await requireAuth(req, ["super_admin"]);
        if (isAuthError(auth)) return auth;

        const { id: idStr } = await params;
        const id = parseId({ id: idStr });
        if (!id) return badRequest("Invalid event type ID");

        const inUse = await prisma.matchEvent.findFirst({ where: { eventTypeId: id } });
        if (inUse) return badRequest("Cannot delete: event type is in use");

        await prisma.eventType.delete({ where: { id } });
        return success({ message: "Deleted" });
    } catch (error) {
        return serverError(error);
    }
}
