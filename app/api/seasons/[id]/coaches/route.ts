import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth, isAuthError } from "@/lib/auth";
import { success, badRequest, notFound, forbidden, serverError, parseUUID } from "@/lib/api-helpers";
import { assertLeagueScope } from "@/lib/scope-guard";

// GET /api/seasons/:id/coaches — list all SeasonClubCoach records for a season
// League Admin sees all; Club Admin sees only their club's coaches
export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const auth = await requireAuth(req);
        if (isAuthError(auth)) return auth;

        const { id: idStr } = await params;
        const seasonId = parseUUID(idStr);
        if (!seasonId) return badRequest("Invalid season ID");

        const season = await prisma.season.findUnique({
            where: { id: seasonId },
            include: { league: true },
        });
        if (!season) return notFound("Season not found");

        const isClubAdmin = auth.roles.some((r) => r.roleName === "club_admin");
        const isLeagueAdmin = auth.roles.some((r) => r.roleName === "league_admin");
        const isSuperAdmin = auth.roles.some((r) => r.roleName === "super_admin");

        if (!isLeagueAdmin && !isSuperAdmin && !isClubAdmin) return forbidden();

        const where: Record<string, unknown> = {
            seasonClub: { seasonId },
        };

        if (isClubAdmin && !isSuperAdmin) {
            const clubId = auth.roles.find((r) => r.roleName === "club_admin")?.clubId;
            if (clubId) where.seasonClub = { seasonId, clubId };
        } else if (isLeagueAdmin && !isSuperAdmin) {
            if (!assertLeagueScope(auth, season.leagueId)) return forbidden();
        }

        const coaches = await prisma.seasonClubCoach.findMany({
            where,
            include: {
                coach: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        licenseLevel: true,
                        nationality: true,
                    },
                },
                seasonClub: {
                    include: {
                        club: { select: { id: true, name: true } },
                    },
                },
            },
            orderBy: { createdAt: "desc" },
        });

        return success(coaches);
    } catch (error) {
        return serverError(error);
    }
}
