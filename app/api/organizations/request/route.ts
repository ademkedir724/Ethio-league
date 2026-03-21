import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { badRequest, created, serverError } from "@/lib/api-helpers";

// POST /api/organizations/request — public endpoint to request a new organization
export async function POST(req: NextRequest) {
  try {
    const {
      organizationName,
      country,
      city,
      description,
      applicantFullName,
      email,
      phone,
    } = await req.json();

    // Validate required fields
    if (!organizationName || !country || !city) {
      return badRequest("Organization name, country, and city are required");
    }
    if (!applicantFullName || !email || !phone) {
      return badRequest("Applicant full name, email, and phone are required");
    }

    // Check if organization name already exists
    const existingOrg = await prisma.organization.findUnique({
      where: { name: organizationName },
    });
    if (existingOrg) {
      return badRequest("An organization with this name already exists");
    }

    // Check if email already exists
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });
    if (existingUser) {
      return badRequest("A user with this email already exists");
    }

    // Create organization with pending status
    const organization = await prisma.organization.create({
      data: {
        name: organizationName,
        country,
        city,
        description,
        status: "pending",
      },
    });

    // Create user with inactive status and no password
    // Password will be set after organization approval
    const user = await prisma.user.create({
      data: {
        fullName: applicantFullName,
        email,
        phone,
        passwordHash: "", // No password initially - will be set after approval
        status: "inactive",
      },
    });

    // Get the organization_admin role
    const orgAdminRole = await prisma.role.findUnique({
      where: { name: "organization_admin" },
    });

    // Link user to organization with organization_admin role (pending approval)
    if (orgAdminRole) {
      await prisma.userRoleScope.create({
        data: {
          userId: user.id,
          roleId: orgAdminRole.id,
          organizationId: organization.id,
        },
      });
    }

    return created({
      message: "Organization request submitted successfully",
      organizationId: organization.id,
      userId: user.id,
    });
  } catch (error) {
    return serverError(error);
  }
}
