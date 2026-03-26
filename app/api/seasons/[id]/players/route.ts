import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth, isAuthError } from "@/lib/auth";
import { success, created, badRequest, forbidden, serverError, parseUUID } from "@/lib/api-helpers";
import { assertLeagueScope, assertOrgScope } from "@/lib/scope-guard";

// GET /api/seasons/[id]/players
export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const auth = await requireAuth(req);
        if (isAuthError(auth)) return auth;

        const { id } = await params;
        const seasonId = parseUUID(id);
        if (!seasonId) return badRequest("Invalid season ID");

        const season = await prisma.season.findUnique({ where: { id: seasonId }, include: { league: true } });
        if (!season) return badRequest("Season not found");

        if (!assertLeagueScope(auth, season.leagueId) && !assertOrgScope(auth, season.league.organizationId)) {
            return forbidden();
        }

        const records = await prisma.seasonClubPlayer.findMany({
            where: { seasonClub: { seasonId } },
            include: {
                player: true,
                seasonClub: { include: { club: { select: { id: true, name: true } } } },
                position: true,
            },
        });

        return success(records);
    } catch (error) {
        return serverError(error);
    }
}

// POST /api/seasons/[id]/players — assign a player to a season club
export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const auth = await requireAuth(req, ["league_admin", "super_admin"]);
        if (isAuthError(auth)) return auth;

        const { id } = await params;
        const seasonId = parseUUID(id);
        if (!seasonId) return badRequest("Invalid season ID");

        const season = await prisma.season.findUnique({ where: { id: seasonId }, include: { league: true } });
        if (!season) return badRequest("Season not found");

        if (!assertLeagueScope(auth, season.leagueId) && !assertOrgScope(auth, season.league.organizationId)) {
            return forbidden();
        }

        const body = await req.json();
        const { clubId, playerId, jerseyNumber, positionId } = body;

        if (!clubId) return badRequest("clubId is required");
        if (!playerId) return badRequest("playerId is required");

        const seasonClub = await prisma.seasonClub.findUnique({
            where: { seasonId_clubId: { seasonId, clubId } },
        });
        if (!seasonClub) return badRequest("Club is not registered in this season");
        if (seasonClub.status !== "active") return badRequest("Club must be active in the season to assign players");

        const duplicate = await prisma.seasonClubPlayer.findFirst({
            where: { seasonClubId: seasonClub.id, playerId },
        });
        if (duplicate) return badRequest("Player is already assigned to this season");

        const record = await prisma.seasonClubPlayer.create({
            data: {
                seasonClubId: seasonClub.id,
                playerId,
                jerseyNumber: jerseyNumber || null,
                positionId: positionId || null,
            },
        });

        return created(record);
    } catch (error) {
        return serverError(error);
    }
}
