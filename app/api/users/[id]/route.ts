import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth, isAuthError } from "@/lib/auth";
import {
  success,
  badRequest,
  notFound,
  serverError,
  parseUUID,
} from "@/lib/api-helpers";

// GET /api/users/:id
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: idStr } = await params;
    const id = parseUUID(idStr);
    if (!id) return badRequest("Invalid user ID");

    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        fullName: true,
        phone: true,
        status: true,
        createdAt: true,
        userRoleScopes: {
          include: { role: true },
        },
      },
    });

    if (!user) return notFound("User not found");
    return success(user);
  } catch (error) {
    return serverError(error);
  }
}

// PATCH /api/users/:id — update user (super_admin only, or self for profile fields)
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth(req);
    if (isAuthError(auth)) return auth;

    const { id: idStr } = await params;
    const id = parseUUID(idStr);
    if (!id) return badRequest("Invalid user ID");

    const isSuperAdmin = auth.roles.some((r) => r.roleName === "super_admin");
    const isSelf = auth.userId === id;

    if (!isSuperAdmin && !isSelf) {
      return badRequest("Forbidden");
    }

    const data = await req.json();
    const allowedFields = isSuperAdmin
      ? ["fullName", "phone", "status"]
      : ["fullName", "phone"];

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
        fullName: true,
        phone: true,
        status: true,
      },
    });

    return success(user);
  } catch (error) {
    return serverError(error);
  }
}

// DELETE /api/users/:id — super_admin only
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth(req, ["super_admin"]);
    if (isAuthError(auth)) return auth;

    const { id: idStr } = await params;
    const id = parseUUID(idStr);
    if (!id) return badRequest("Invalid user ID");

    await prisma.user.delete({ where: { id } });
    return success({ message: "User deleted" });
  } catch (error) {
    return serverError(error);
  }
}
