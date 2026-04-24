import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { success, serverError } from "@/lib/api-helpers";

// GET /api/fan/leagues
// Public — no auth required
// Query: ?search, ?leagueTypeId, ?genderCategory, ?ageCategory, ?organizationId, ?status
export async function GET(req: NextRequest) {
    try {
        const { searchParams } = req.nextUrl;
        const search = searchParams.get("search");
        const leagueTypeId = searchParams.get("leagueTypeId");
        const genderCategory = searchParams.get("genderCategory");
        const ageCategory = searchParams.get("ageCategory");
        const organizationId = searchParams.get("organizationId");
        const status = searchParams.get("status") ?? "active";

        const leagues = await prisma.league.findMany({
            where: {
                status,
                ...(search && { name: { contains: search, mode: "insensitive" } }),
                ...(leagueTypeId && { leagueTypeId: Number(leagueTypeId) }),
                ...(genderCategory && { genderCategory }),
                ...(ageCategory && { ageCategory }),
                ...(organizationId && { organizationId }),
            },
            include: {
                organization: { select: { id: true, name: true, logoUrl: true } },
                leagueType: { select: { id: true, name: true } },
                _count: { select: { seasons: true, clubs: true } },
            },
            orderBy: { name: "asc" },
        });

        return success(leagues);
    } catch (error) {
        return serverError(error);
    }
}

export { handleOptions as OPTIONS } from "@/lib/fan-cors";
