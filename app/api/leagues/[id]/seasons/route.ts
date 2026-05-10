import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth, isAuthError } from "@/lib/auth";
import { badRequest, notFound, forbidden, serverError, parseUUID, parsePagination, paginated } from "@/lib/api-helpers";
import { assertLeagueScope, assertOrgScope } from "@/lib/scope-guard";

// GET /api/leagues/[id]/seasons — list seasons for a league
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth(req);
    if (isAuthError(auth)) return auth;

    const { id } = await params;
    const leagueId = parseUUID(id);
    if (!leagueId) return badRequest("Invalid league ID");

    const league = await prisma.league.findUnique({ where: { id: leagueId } });
    if (!league) return notFound("League not found");

    if (!assertLeagueScope(auth, leagueId) && !assertOrgScope(auth, league.organizationId)) {
      return forbidden();
    }

    const sp = req.nextUrl.searchParams;
    const { page, limit, skip } = parsePagination(sp);

    const where = { leagueId };

    const [total, seasons] = await Promise.all([
      prisma.season.count({ where }),
      prisma.season.findMany({
        where,
        include: {
          _count: { select: { seasonClubs: true, matches: true } },
        },
        orderBy: { startDate: "desc" },
        skip,
        take: limit,
      }),
    ]);

    return paginated(seasons, total, page, limit);
  } catch (error) {
    return serverError(error);
  }
}
