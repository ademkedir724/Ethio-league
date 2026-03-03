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

// GET /api/users/:id
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: idStr } = await params;
    const id = parseId({ id: idStr });
    if (!id) return badRequest("Invalid user ID");

    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        avatarUrl: true,
        createdAt: true,
      },
    });

    if (!user) return notFound("User not found");
    return success(user);
  } catch (error) {
    return serverError(error);
  }
}

// PATCH /api/users/:id
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = requireAuth(req, ["SUPER_ADMIN"]);
    if (isAuthError(auth)) return auth;

    const { id: idStr } = await params;
    const id = parseId({ id: idStr });
    if (!id) return badRequest("Invalid user ID");

    const data = await req.json();
    const allowedFields = ["name", "role", "avatarUrl"];
    const updateData: Record<string, unknown> = {};
    for (const field of allowedFields) {
      if (data[field] !== undefined) updateData[field] = data[field];
    }

    const user = await prisma.user.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        avatarUrl: true,
      },
    });

    return success(user);
  } catch (error) {
    return serverError(error);
  }
}

// DELETE /api/users/:id
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = requireAuth(req, ["SUPER_ADMIN"]);
    if (isAuthError(auth)) return auth;

    const { id: idStr } = await params;
    const id = parseId({ id: idStr });
    if (!id) return badRequest("Invalid user ID");

    await prisma.user.delete({ where: { id } });
    return success({ message: "User deleted" });
  } catch (error) {
    return serverError(error);
  }
}
