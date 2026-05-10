import { NextRequest } from "next/server";
import { requireAuth, isAuthError } from "@/lib/auth";
import { serverError } from "@/lib/api-helpers";
import {
    computeAndPersistPlayerRating,
    computeAndPersistClubRating,
    computeAndPersistLeagueRating,
    computeAndPersistCoachRating,
    computeAndPersistRefereeRating,
} from "@/lib/ratings";
import prisma from "@/lib/prisma";

// POST /api/ratings/recompute — fire-and-forget (legacy, kept for config-save trigger)
export async function POST(req: NextRequest) {
    try {
        const auth = await requireAuth(req, ["super_admin"]);
        if (isAuthError(auth)) return auth;

        // Fire and forget — no streaming
        runFullRecomputeBackground().catch((err) =>
            console.error("[ratings] full recompute failed", err)
        );

        return Response.json({ message: "Recompute started" }, { status: 202 });
    } catch (error) {
        return serverError(error);
    }
}

// GET /api/ratings/recompute — streaming SSE progress
export async function GET(req: NextRequest) {
    try {
        const auth = await requireAuth(req, ["super_admin"]);
        if (isAuthError(auth)) return auth;
    } catch {
        return new Response("Unauthorized", { status: 401 });
    }

    const encoder = new TextEncoder();

    const stream = new ReadableStream({
        async start(controller) {
            const send = (data: object) => {
                try {
                    controller.enqueue(
                        encoder.encode(`data: ${JSON.stringify(data)}\n\n`)
                    );
                } catch {
                    // client disconnected
                }
            };

            try {
                // ── Players ──────────────────────────────────────────────────
                const players = await prisma.player.findMany({ select: { id: true } });
                let playerDone = 0, playerFailed = 0;
                send({ phase: "players", total: players.length, done: 0, failed: 0 });

                for (const p of players) {
                    try {
                        await computeAndPersistPlayerRating(p.id, prisma);
                        playerDone++;
                    } catch (err) {
                        playerFailed++;
                        console.error(`[ratings] player ${p.id}`, err);
                    }
                    if (playerDone % 10 === 0 || playerDone === players.length) {
                        send({ phase: "players", total: players.length, done: playerDone, failed: playerFailed });
                    }
                }
                send({ phase: "players", total: players.length, done: playerDone, failed: playerFailed, complete: true });

                // ── Clubs ─────────────────────────────────────────────────────
                const clubs = await prisma.club.findMany({ select: { id: true } });
                let clubDone = 0, clubFailed = 0;
                send({ phase: "clubs", total: clubs.length, done: 0, failed: 0 });

                for (const c of clubs) {
                    try {
                        await computeAndPersistClubRating(c.id, prisma);
                        clubDone++;
                    } catch (err) {
                        clubFailed++;
                        console.error(`[ratings] club ${c.id}`, err);
                    }
                    if (clubDone % 5 === 0 || clubDone === clubs.length) {
                        send({ phase: "clubs", total: clubs.length, done: clubDone, failed: clubFailed });
                    }
                }
                send({ phase: "clubs", total: clubs.length, done: clubDone, failed: clubFailed, complete: true });

                // ── Coaches ───────────────────────────────────────────────────
                const coaches = await prisma.coach.findMany({ select: { id: true } });
                let coachDone = 0, coachFailed = 0;
                send({ phase: "coaches", total: coaches.length, done: 0, failed: 0 });

                for (const c of coaches) {
                    try {
                        await computeAndPersistCoachRating(c.id, prisma);
                        coachDone++;
                    } catch (err) {
                        coachFailed++;
                        console.error(`[ratings] coach ${c.id}`, err);
                    }
                    if (coachDone % 5 === 0 || coachDone === coaches.length) {
                        send({ phase: "coaches", total: coaches.length, done: coachDone, failed: coachFailed });
                    }
                }
                send({ phase: "coaches", total: coaches.length, done: coachDone, failed: coachFailed, complete: true });

                // ── Referees ──────────────────────────────────────────────────
                const referees = await prisma.referee.findMany({ select: { id: true } });
                let refDone = 0, refFailed = 0;
                send({ phase: "referees", total: referees.length, done: 0, failed: 0 });

                for (const r of referees) {
                    try {
                        await computeAndPersistRefereeRating(r.id, prisma);
                        refDone++;
                    } catch (err) {
                        refFailed++;
                        console.error(`[ratings] referee ${r.id}`, err);
                    }
                    if (refDone % 5 === 0 || refDone === referees.length) {
                        send({ phase: "referees", total: referees.length, done: refDone, failed: refFailed });
                    }
                }
                send({ phase: "referees", total: referees.length, done: refDone, failed: refFailed, complete: true });

                // ── Leagues ───────────────────────────────────────────────────
                const leagues = await prisma.league.findMany({ select: { id: true } });
                let leagueDone = 0, leagueFailed = 0;
                send({ phase: "leagues", total: leagues.length, done: 0, failed: 0 });

                for (const l of leagues) {
                    try {
                        await computeAndPersistLeagueRating(l.id, prisma);
                        leagueDone++;
                    } catch (err) {
                        leagueFailed++;
                        console.error(`[ratings] league ${l.id}`, err);
                    }
                    if (leagueDone % 3 === 0 || leagueDone === leagues.length) {
                        send({ phase: "leagues", total: leagues.length, done: leagueDone, failed: leagueFailed });
                    }
                }
                send({ phase: "leagues", total: leagues.length, done: leagueDone, failed: leagueFailed, complete: true });

                // ── Done ──────────────────────────────────────────────────────
                const totalProcessed = playerDone + clubDone + coachDone + refDone + leagueDone;
                const totalFailed = playerFailed + clubFailed + coachFailed + refFailed + leagueFailed;
                send({
                    phase: "done",
                    totalProcessed,
                    totalFailed,
                    summary: {
                        players: { done: playerDone, failed: playerFailed, total: players.length },
                        clubs: { done: clubDone, failed: clubFailed, total: clubs.length },
                        coaches: { done: coachDone, failed: coachFailed, total: coaches.length },
                        referees: { done: refDone, failed: refFailed, total: referees.length },
                        leagues: { done: leagueDone, failed: leagueFailed, total: leagues.length },
                    },
                });
            } catch (err) {
                console.error("[ratings] SSE recompute error", err);
                send({ phase: "error", message: String(err) });
            } finally {
                controller.close();
            }
        },
    });

    return new Response(stream, {
        headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            Connection: "keep-alive",
        },
    });
}

// Background version (no status filter — compute ALL entities)
async function runFullRecomputeBackground(): Promise<void> {
    const players = await prisma.player.findMany({ select: { id: true } });
    for (const p of players) {
        await computeAndPersistPlayerRating(p.id, prisma).catch((err) =>
            console.error(`[ratings] player ${p.id}`, err)
        );
    }
    const clubs = await prisma.club.findMany({ select: { id: true } });
    for (const c of clubs) {
        await computeAndPersistClubRating(c.id, prisma).catch((err) =>
            console.error(`[ratings] club ${c.id}`, err)
        );
    }
    const coaches = await prisma.coach.findMany({ select: { id: true } });
    for (const c of coaches) {
        await computeAndPersistCoachRating(c.id, prisma).catch((err) =>
            console.error(`[ratings] coach ${c.id}`, err)
        );
    }
    const referees = await prisma.referee.findMany({ select: { id: true } });
    for (const r of referees) {
        await computeAndPersistRefereeRating(r.id, prisma).catch((err) =>
            console.error(`[ratings] referee ${r.id}`, err)
        );
    }
    const leagues = await prisma.league.findMany({ select: { id: true } });
    for (const l of leagues) {
        await computeAndPersistLeagueRating(l.id, prisma).catch((err) =>
            console.error(`[ratings] league ${l.id}`, err)
        );
    }
}
