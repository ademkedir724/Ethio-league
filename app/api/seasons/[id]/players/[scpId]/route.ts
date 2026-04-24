import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth, isAuthError } from "@/lib/auth";
import {
    success,
    badRequest,
    notFound,
    forbidden,
    serverError,
    parseUUID,
} from "@/lib/api-helpers";
import { assertLeagueScope } from "@/lib/scope-guard";

// PATCH /api/seasons/[id]/players/[scpId] — approve or reject a player
export async function PATCH(
    req: NextRequest,
    { params }: { params: Promise<{ id: string; scpId: string }> }
) {
    try {
        const auth = await requireAuth(req, ["league_admin", "super_admin"]);
        if (isAuthError(auth)) return auth;

        const { id, scpId } = await params;
        const seasonId = parseUUID(id);
        if (!seasonId) return badRequest("Invalid season ID");
        const assignmentId = parseUUID(scpId);
        if (!assignmentId) return badRequest("Invalid assignment ID");

        const season = await prisma.season.findUnique({ where: { id: seasonId } });
        if (!season) return notFound("Season not found");
        if (!assertLeagueScope(auth, season.leagueId)) return forbidden();

        const { status } = await req.json();
        if (!["active", "rejected"].includes(status)) return badRequest("status must be 'active' or 'rejected'");

        const record = await prisma.seasonClubPlayer.findUnique({ where: { id: assignmentId } });
        if (!record) return notFound("Assignment not found");

        const updated = await prisma.seasonClubPlayer.update({
            where: { id: assignmentId },
            data: { status },
        });

        return success(updated);
    } catch (error) {
        return serverError(error);
    }
}

// DELETE /api/seasons/[id]/players/[scpId] — remove a player from a season
export async function DELETE(
    req: NextRequest,
    { params }: { params: Promise<{ id: string; scpId: string }> }
) {
    try {
        const auth = await requireAuth(req, ["league_admin", "super_admin"]);
        if (isAuthError(auth)) return auth;

        const { id, scpId } = await params;
        const seasonId = parseUUID(id);
        if (!seasonId) return badRequest("Invalid season ID");
        const assignmentId = parseUUID(scpId);
        if (!assignmentId) return badRequest("Invalid assignment ID");

        const season = await prisma.season.findUnique({ where: { id: seasonId } });
        if (!season) return notFound("Season not found");
        if (!assertLeagueScope(auth, season.leagueId)) return forbidden();

        const record = await prisma.seasonClubPlayer.findUnique({ where: { id: assignmentId } });
        if (!record) return notFound("Assignment not found");

        await prisma.seasonClubPlayer.delete({ where: { id: assignmentId } });
        return success({ message: "Player removed from season" });
    } catch (error) {
        return serverError(error);
    }
}
