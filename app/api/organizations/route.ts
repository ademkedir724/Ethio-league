import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth, isAuthError } from "@/lib/auth";
import {
  success,
  created,
  badRequest,
  serverError,
} from "@/lib/api-helpers";

// GET /api/organizations — list all organizations
export async function GET(req: NextRequest) {
  try {
    const auth = requireAuth(req);
    if (isAuthError(auth)) return auth;

    const orgs = await prisma.organization.findMany({
      include: { owner: { select: { id: true, name: true, email: true } } },
      orderBy: { createdAt: "desc" },
    });
    return success(orgs);
  } catch (error) {
    return serverError(error);
  }
}

// POST /api/organizations — request a new organization
export async function POST(req: NextRequest) {
  try {
    const auth = requireAuth(req);
    if (isAuthError(auth)) return auth;

    const { name, description, logoUrl } = await req.json();

    if (!name) return badRequest("Organization name is required");

    const existing = await prisma.organization.findUnique({ where: { name } });
    if (existing) return badRequest("Organization name already taken");

    const org = await prisma.organization.create({
      data: {
        name,
        description,
        logoUrl,
        ownerId: auth.userId,
        status: "PENDING",
      },
    });

    return created(org);
  } catch (error) {
    return serverError(error);
  }
}
