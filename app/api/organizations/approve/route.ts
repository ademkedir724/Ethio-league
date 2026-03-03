import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth, isAuthError } from "@/lib/auth";
import { success, badRequest, notFound, serverError } from "@/lib/api-helpers";

// POST /api/organizations/approve — super admin approves or rejects an org
export async function POST(req: NextRequest) {
  try {
    const auth = requireAuth(req, ["SUPER_ADMIN"]);
    if (isAuthError(auth)) return auth;

    const { organizationId, status } = await req.json();

    if (!organizationId || !status) {
      return badRequest("organizationId and status are required");
    }

    if (!["APPROVED", "REJECTED"].includes(status)) {
      return badRequest("Status must be APPROVED or REJECTED");
    }

    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
    });
    if (!org) return notFound("Organization not found");

    const updated = await prisma.organization.update({
      where: { id: organizationId },
      data: { status },
    });

    return success(updated);
  } catch (error) {
    return serverError(error);
  }
}
