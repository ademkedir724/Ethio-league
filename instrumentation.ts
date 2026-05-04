/**
 * instrumentation.ts — Next.js startup hook
 *
 * Runs once when the Node.js server starts. Triggers a first-run rating
 * backfill if no EntityRating records exist yet.
 *
 * @see https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */
export async function register() {
    // Only run in the Node.js runtime (not Edge)
    if (process.env.NEXT_RUNTIME !== "nodejs") return;

    // Delay slightly so the connection pool has time to warm up before
    // the backfill fires its first query (important for cold-start on Neon).
    await new Promise((resolve) => setTimeout(resolve, 5_000));

    const { runBackfillIfNeeded } = await import("./lib/ratings");

    runBackfillIfNeeded().catch((err) =>
        console.error("[ratings] First-run backfill error", err)
    );
}
