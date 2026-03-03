import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth, isAuthError } from "@/lib/auth";
import {
  success,
  badRequest,
  notFound,
  serverError,
  parseId,
} from "@/lib/api-helpers";

// GET /api/organizations/:id
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = requireAuth(req);
    if (isAuthError(auth)) return auth;

    const { id: idStr } = await params;
    const id = parseId({ id: idStr });
    if (!id) return badRequest("Invalid organization ID");

    const org = await prisma.organization.findUnique({
      where: { id },
      include: {
        owner: { select: { id: true, name: true, email: true } },
        leagues: true,
      },
    });

    if (!org) return notFound("Organization not found");
    return success(org);
  } catch (error) {
    return serverError(error);
  }
}

// PATCH /api/organizations/:id
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = requireAuth(req, ["SUPER_ADMIN", "LEAGUE_ADMIN"]);
    if (isAuthError(auth)) return auth;

    const { id: idStr } = await params;
    const id = parseId({ id: idStr });
    if (!id) return badRequest("Invalid organization ID");

    const data = await req.json();
    const allowedFields = ["name", "description", "logoUrl"];
    const updateData: Record<string, unknown> = {};
    for (const field of allowedFields) {
      if (data[field] !== undefined) updateData[field] = data[field];
    }

    const org = await prisma.organization.update({
      where: { id },
      data: updateData,
    });

    return success(org);
  } catch (error) {
    return serverError(error);
  }
}

// DELETE /api/organizations/:id
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = requireAuth(req, ["SUPER_ADMIN"]);
    if (isAuthError(auth)) return auth;

    const { id: idStr } = await params;
    const id = parseId({ id: idStr });
    if (!id) return badRequest("Invalid organization ID");

    await prisma.organization.delete({ where: { id } });
    return success({ message: "Organization deleted" });
  } catch (error) {
    return serverError(error);
  }
}
