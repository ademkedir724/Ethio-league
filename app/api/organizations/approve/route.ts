import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth, isAuthError } from "@/lib/auth";
import { success, badRequest, notFound, serverError } from "@/lib/api-helpers";

// POST /api/organizations/approve — super_admin approves or rejects an org
// Also assigns organization_admin role to requesting user when approved
export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuth(req, ["super_admin"]);
    if (isAuthError(auth)) return auth;

    const { organizationId, status, adminUserId } = await req.json();

    if (!organizationId || !status) {
      return badRequest("organizationId and status are required");
    }

    if (!["approved", "rejected"].includes(status)) {
      return badRequest('Status must be "approved" or "rejected"');
    }

    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
    });
    if (!org) return notFound("Organization not found");

    const updated = await prisma.organization.update({
      where: { id: organizationId },
      data: { status },
    });

    // If approved and adminUserId provided, assign organization_admin role
    if (status === "approved" && adminUserId) {
      const orgAdminRole = await prisma.role.findUnique({
        where: { name: "organization_admin" },
      });
      if (orgAdminRole) {
        // Check if role scope already exists
        const existing = await prisma.userRoleScope.findFirst({
          where: {
            userId: adminUserId,
            roleId: orgAdminRole.id,
            organizationId: organizationId,
          },
        });
        if (!existing) {
          await prisma.userRoleScope.create({
            data: {
              userId: adminUserId,
              roleId: orgAdminRole.id,
              organizationId: organizationId,
            },
          });
        }
      }
    }

    return success(updated);
  } catch (error) {
    return serverError(error);
  }
}
