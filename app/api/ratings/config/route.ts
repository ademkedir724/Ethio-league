import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth, isAuthError } from "@/lib/auth";
import { success, serverError } from "@/lib/api-helpers";
import { runFullRecompute } from "@/lib/ratings";

export async function GET(req: NextRequest) {
    try {
        const auth = await requireAuth(req, ["super_admin"]);
        if (isAuthError(auth)) return auth;

        let config = await prisma.ratingConfig.findFirst({ where: { isActive: true } });

        // Auto-seed default config on first access if none exists
        if (!config) {
            config = await prisma.ratingConfig.create({ data: { isActive: true } });
        }

        return success(config);
    } catch (error) {
        return serverError(error);
    }
}

export async function PUT(req: NextRequest) {
    try {
        const auth = await requireAuth(req, ["super_admin"]);
        if (isAuthError(auth)) return auth;

        const body = await req.json();
        const errors: Record<string, string> = {};

        const weightFields = ["goalWeight", "assistWeight", "appearanceWeight", "cleanSheetWeight", "winRateWeight"];
        const penaltyFields = ["yellowCardPenalty", "redCardPenalty"];
        const normFields = ["goalDiffNormMax", "pointsPerMatchNormMax", "maxSeasonsNorm", "leagueGoalsNormMax"];

        for (const f of weightFields) {
            if (body[f] !== undefined && (body[f] < 0 || body[f] > 10)) {
                errors[f] = `${f} must be between 0.0 and 10.0`;
            }
        }
        for (const f of penaltyFields) {
            if (body[f] !== undefined && (body[f] < 0 || body[f] > 10)) {
                errors[f] = `${f} must be between 0.0 and 10.0`;
            }
        }
        for (const f of normFields) {
            if (body[f] !== undefined && (body[f] < 0.1 || body[f] > 100)) {
                errors[f] = `${f} must be between 0.1 and 100.0`;
            }
        }
        if (body.seasonDecayRate !== undefined && (body.seasonDecayRate < 0 || body.seasonDecayRate > 1)) {
            errors.seasonDecayRate = "seasonDecayRate must be between 0.0 and 1.0";
        }
        if (body.seasonMinWeight !== undefined && (body.seasonMinWeight < 0 || body.seasonMinWeight > 1)) {
            errors.seasonMinWeight = "seasonMinWeight must be between 0.0 and 1.0";
        }

        if (Object.keys(errors).length > 0) {
            return NextResponse.json({ error: "Validation failed", fields: errors }, { status: 400 });
        }

        // Deactivate current config and create new one
        await prisma.ratingConfig.updateMany({ where: { isActive: true }, data: { isActive: false } });
        const newConfig = await prisma.ratingConfig.create({ data: { ...body, isActive: true } });

        // Fire-and-forget full recompute with new weights
        runFullRecompute().catch((err) =>
            console.error("[ratings] recompute after config update failed", err)
        );

        return success(newConfig);
    } catch (error) {
        return serverError(error);
    }
}
