import { NextRequest } from "next/server";
import crypto from "crypto";
import prisma from "@/lib/prisma";
import { requireAuth, isAuthError } from "@/lib/auth";
import { success, badRequest, notFound, serverError } from "@/lib/api-helpers";
import { sendPasswordSetupEmail } from "@/lib/email";
import { logAudit } from "@/lib/audit";

// Helper to generate a secure random token
function generateSecureToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

// POST /api/organizations/approve — super_admin approves or rejects an org
export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuth(req, ["super_admin"]);
    if (isAuthError(auth)) return auth;

    const { organizationId, status } = await req.json();

    if (!organizationId || !status) {
      return badRequest("organizationId and status are required");
    }

    if (!["approved", "rejected"].includes(status)) {
      return badRequest('Status must be "approved" or "rejected"');
    }

    // Find the organization
    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
    });
    if (!org) return notFound("Organization not found");

    // Find the user associated with this organization (via UserRoleScope)
    const userRoleScope = await prisma.userRoleScope.findFirst({
      where: { organizationId: organizationId },
      include: {
        user: true,
        role: true,
      },
    });

    if (status === "approved") {
      // Update organization status
      await prisma.organization.update({
        where: { id: organizationId },
        data: { status: "approved" },
      });

      // If there's an associated user, activate them and generate password reset token
      if (userRoleScope?.user) {
        const token = generateSecureToken();
        const expires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour from now

        await prisma.user.update({
          where: { id: userRoleScope.user.id },
          data: {
            status: "active",
            passwordResetToken: token,
            passwordResetExpires: expires,
          },
        });

        try {
          await sendPasswordSetupEmail(userRoleScope.user.email, token);
        } catch (emailErr) {
          // Email failure must not block the approval — log it and continue
          console.error("[approve] Password setup email failed:", emailErr);
          await logAudit({
            userId: auth.userId,
            actionType: "email_failure",
            targetId: userRoleScope.user.id,
            targetType: "user",
            description: "Password setup email failed",
          });
        }

        await logAudit({
          userId: auth.userId,
          actionType: "organization_approved",
          targetId: org.id,
          targetType: "organization",
          description: "Organization approved",
        });

        const responseBody: Record<string, unknown> = {
          message: "Organization approved successfully",
          organization: {
            id: org.id,
            name: org.name,
            status: "approved",
          },
          user: {
            id: userRoleScope.user.id,
            email: userRoleScope.user.email,
            fullName: userRoleScope.user.fullName,
          },
          expiresAt: expires.toISOString(),
          // Always include the setup link — shown in UI popup as fallback if email fails
          passwordSetupLink: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/set-password?token=${token}`,
        };

        return success(responseBody);
      }

      await logAudit({
        userId: auth.userId,
        actionType: "organization_approved",
        targetId: org.id,
        targetType: "organization",
        description: "Organization approved",
      });

      return success({
        message: "Organization approved successfully",
        organization: {
          id: org.id,
          name: org.name,
          status: "approved",
        },
      });
    } else {
      // Rejected - update organization status
      await prisma.organization.update({
        where: { id: organizationId },
        data: { status: "rejected" },
      });

      // Optionally deactivate the associated user
      if (userRoleScope?.user) {
        await prisma.user.update({
          where: { id: userRoleScope.user.id },
          data: { status: "inactive" },
        });
      }

      await logAudit({
        userId: auth.userId,
        actionType: "organization_rejected",
        targetId: org.id,
        targetType: "organization",
        description: "Organization rejected",
      });

      return success({
        message: "Organization rejected",
        organization: {
          id: org.id,
          name: org.name,
          status: "rejected",
        },
      });
    }
  } catch (error) {
    return serverError(error);
  }
}
