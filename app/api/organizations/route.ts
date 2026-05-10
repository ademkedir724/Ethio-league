import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth, isAuthError } from "@/lib/auth";
import {
  success,
  created,
  badRequest,
  serverError,
  parsePagination,
  paginated,
} from "@/lib/api-helpers";

// GET /api/organizations — list organizations with applicant info
// ?page=1&limit=20&search=<name>&status=<status>
export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuth(req);
    if (isAuthError(auth)) return auth;

    const sp = req.nextUrl.searchParams;
    const { page, limit, skip } = parsePagination(sp);
    const search = sp.get("search")?.trim();
    const status = sp.get("status");

    const where: Record<string, unknown> = {};
    if (status) where.status = status;
    if (search) where.name = { contains: search, mode: "insensitive" };

    const include = {
      userRoleScopes: {
        include: {
          user: { select: { id: true, fullName: true, email: true, phone: true } },
        },
      },
    };

    const [total, orgs] = await Promise.all([
      prisma.organization.count({ where }),
      prisma.organization.findMany({
        where,
        include,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
    ]);

    const data = orgs.map((org) => {
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

    return paginated(data, total, page, limit);
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
