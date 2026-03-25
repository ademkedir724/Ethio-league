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
import { assertMEASeasonScope } from "@/lib/scope-guard";
import { logAudit } from "@/lib/audit";

// POST /api/matches/[id]/approve — MEA match approval
export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const auth = await requireAuth(req, [
            "match_event_admin",
            "league_admin",
            "super_admin",
        ]);
        if (isAuthError(auth)) return auth;

        const { id } = await params;
        const matchId = parseUUID(id);
        if (!matchId) return badRequest("Invalid match ID");

        const match = await prisma.match.findUnique({ where: { id: matchId } });
        if (!match) return notFound("Match not found");

        if (!assertMEASeasonScope(auth, match.seasonId)) return forbidden();

        if (match.matchDate.getTime() - Date.now() > 24 * 60 * 60 * 1000) {
            return badRequest(
                "Match can only be approved within 24 hours of the scheduled start time"
            );
        }

        if (match.status !== "scheduled" && match.status !== "upcoming") {
            return badRequest("Match cannot be approved in its current status");
        }

        const updatedMatch = await prisma.match.update({
            where: { id: matchId },
            data: { status: "approved" },
        });

        await logAudit({
            userId: auth.userId,
            actionType: "match_approved",
            targetId: matchId,
            targetType: "match",
            description: "Match approved by MEA",
        });

        return success(updatedMatch);
    } catch (error) {
        return serverError(error);
    }
}
