import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth, isAuthError, hasRole, hasOrgRole } from "@/lib/auth";
import {
  success,
  badRequest,
  notFound,
  serverError,
  parseUUID,
} from "@/lib/api-helpers";
import { NextResponse } from "next/server";

// GET /api/organizations/:id
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth(req);
    if (isAuthError(auth)) return auth;

    const { id: idStr } = await params;
    const id = parseUUID(idStr);
    if (!id) return badRequest("Invalid organization ID");

    const org = await prisma.organization.findUnique({
      where: { id },
      include: {
        seasons: true,
      },
    });

    if (!org) return notFound("Organization not found");
    return success(org);
  } catch (error) {
    return serverError(error);
  }
}

// PATCH /api/organizations/:id — update org (super_admin or org's organization_admin)
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth(req);
    if (isAuthError(auth)) return auth;

    const { id: idStr } = await params;
    const id = parseUUID(idStr);
    if (!id) return badRequest("Invalid organization ID");

    const isSuperAdmin = hasRole(auth, ["super_admin"]);
    const isOrgAdmin = hasOrgRole(auth, "organization_admin", id);

    if (!isSuperAdmin && !isOrgAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const data = await req.json();
    const allowedFields = [
      "name",
      "country",
      "city",
      "foundedYear",
      "logoUrl",
      "description",
      "status",
    ];
    const updateData: Record<string, unknown> = {};
    for (const field of allowedFields) {
      if (data[field] !== undefined) updateData[field] = data[field];
    }

    // Only super_admin can change status
    if (updateData.status && !isSuperAdmin) {
      delete updateData.status;
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

// DELETE /api/organizations/:id — super_admin only
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth(req, ["super_admin"]);
    if (isAuthError(auth)) return auth;

    const { id: idStr } = await params;
    const id = parseUUID(idStr);
    if (!id) return badRequest("Invalid organization ID");

    await prisma.organization.delete({ where: { id } });
    return success({ message: "Organization deleted" });
  } catch (error) {
    return serverError(error);
  }
}
