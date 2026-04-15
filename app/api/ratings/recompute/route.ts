import { NextRequest, NextResponse } from "next/server";
import { requireAuth, isAuthError } from "@/lib/auth";
import { serverError } from "@/lib/api-helpers";
import { runFullRecompute } from "@/lib/ratings";

export async function POST(req: NextRequest) {
    try {
        const auth = await requireAuth(req, ["super_admin"]);
        if (isAuthError(auth)) return auth;

        runFullRecompute().catch((err) =>
            console.error("[ratings] full recompute failed", err)
        );

        return NextResponse.json({ message: "Recompute started" }, { status: 202 });
    } catch (error) {
        return serverError(error);
    }
}
