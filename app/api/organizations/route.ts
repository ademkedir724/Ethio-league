import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth, isAuthError } from "@/lib/auth";
import {
  success,
  created,
  badRequest,
  serverError,
} from "@/lib/api-helpers";

// GET /api/organizations — list all organizations with applicant info
export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuth(req);
    if (isAuthError(auth)) return auth;

    const orgs = await prisma.organization.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        userRoleScopes: {
          include: {
            user: {
              select: {
                id: true,
                fullName: true,
                email: true,
                phone: true,
              },
            },
          },
        },
      },
    });

    // Transform to include applicant info
    const orgsWithApplicant = orgs.map((org) => {
      const firstUserScope = org.userRoleScopes[0];
      return {
        id: org.id,
        name: org.name,
        country: org.country,
        city: org.city,
        foundedYear: org.foundedYear,
        logoUrl: org.logoUrl,
        description: org.description,
        status: org.status,
        createdAt: org.createdAt,
        updatedAt: org.updatedAt,
        applicant: firstUserScope?.user || null,
      };
    });

    return success(orgsWithApplicant);
  } catch (error) {
    return serverError(error);
  }
}

// POST /api/organizations — create a new organization (authenticated users)
export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuth(req);
    if (isAuthError(auth)) return auth;

    const { name, country, city, foundedYear, logoUrl, description } =
      await req.json();

    if (!name) return badRequest("Organization name is required");

    const existing = await prisma.organization.findUnique({ where: { name } });
    if (existing) return badRequest("Organization name already taken");

    const org = await prisma.organization.create({
      data: {
        name,
        country,
        city,
        foundedYear,
        logoUrl,
        description,
        status: "pending",
      },
    });

    return created(org);
  } catch (error) {
    return serverError(error);
  }
}
