/**
 * seed-matches.ts
 *
 * For the 2025/26 Ethiopian Premier League season:
 *  - Processes all matches in rounds 1–32
 *  - For each match:
 *    1. Builds lineups from each club's active SeasonClubPlayers
 *       (11 starters + up to 7 bench)
 *    2. Simulates a realistic scoreline (avg ~2.5 goals, max 6)
 *    3. Creates MatchEvent records:
 *       - goals (with optional assist)
 *       - yellow cards (0–5 per match)
 *       - red cards (0–3 per match, realistic rarity)
 *       - own goals (rare)
 *    4. Sets match status → "approved", homeScore, awayScore
 *
 * Run with:  npx tsx prisma/seed-matches.ts
 */

import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const pool = new Pool({
    connectionString: process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL!,
    connectionTimeoutMillis: 30_000,
    idleTimeoutMillis: 30_000,
    max: 1,
});
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

const SEASON_ID = process.env.SEASON_ID ?? "bd1afd5c-b173-49bd-b8bd-97bc6f60c77e";
const MAX_ROUNDS = 32;

// ─── Seeded PRNG (deterministic but varied) ───────────────────────────────────
// Simple mulberry32 — gives reproducible results per match
function makePrng(seed: number) {
    let s = seed >>> 0;
    return function rand(): number {
        s += 0x6d2b79f5;
        let t = Math.imul(s ^ (s >>> 15), 1 | s);
        t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

function randInt(rand: () => number, min: number, max: number): number {
    return Math.floor(rand() * (max - min + 1)) + min;
}

function pickRandom<T>(rand: () => number, arr: T[]): T {
    return arr[Math.floor(rand() * arr.length)];
}

// ─── Realistic goal distribution ─────────────────────────────────────────────
// Weighted: 0-0 is possible (~8%), most games 1-3 goals total
// Max 6 goals per match
function simulateGoals(rand: () => number): { home: number; away: number } {
    // Total goals: weighted toward 1-3, rare 5-6
    const weights = [8, 14, 22, 22, 16, 10, 5, 3]; // 0..7 goals total
    const totalGoals = weightedPick(rand, weights);
    if (totalGoals === 0) return { home: 0, away: 0 };

    // Split between home and away — home advantage: home scores ~55% of goals
    let home = 0;
    let away = 0;
    for (let i = 0; i < totalGoals; i++) {
        if (rand() < 0.55) home++; else away++;
    }
    return { home, away };
}

function weightedPick(rand: () => number, weights: number[]): number {
    const total = weights.reduce((a, b) => a + b, 0);
    let r = rand() * total;
    for (let i = 0; i < weights.length; i++) {
        r -= weights[i];
        if (r <= 0) return i;
    }
    return weights.length - 1;
}

// ─── Realistic card distribution ─────────────────────────────────────────────
function simulateCards(rand: () => number): { yellows: number; reds: number } {
    // Yellow cards: 0-5, avg ~2.5 per match
    const yellowWeights = [5, 15, 25, 25, 18, 12]; // 0..5
    const yellows = weightedPick(rand, yellowWeights);

    // Red cards: 0-3, very rare — ~70% chance of 0
    const redWeights = [70, 22, 6, 2]; // 0..3
    const reds = weightedPick(rand, redWeights);

    return { yellows, reds };
}

// ─── Assign minutes realistically ────────────────────────────────────────────
function assignMinutes(rand: () => number, count: number, maxMinute = 90): number[] {
    const minutes: number[] = [];
    for (let i = 0; i < count; i++) {
        // Goals cluster in 30-90 range, cards spread more evenly
        minutes.push(randInt(rand, 1, maxMinute));
    }
    return minutes.sort((a, b) => a - b);
}

// ─── Position helpers ─────────────────────────────────────────────────────────
const OUTFIELD_CODES = new Set(["CB", "RB", "LB", "CDM", "CM", "CAM", "LW", "RW", "ST", "CF"]);
const FORWARD_CODES = new Set(["ST", "CF", "LW", "RW", "CAM"]);
const GK_CODE = "GK";

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
    console.log(`\n⚽  seed-matches.ts  →  season ${SEASON_ID}  (rounds 1–${MAX_ROUNDS})\n`);

    // ── Fetch event type IDs ───────────────────────────────────────────────────
    const eventTypes = await prisma.eventType.findMany();
    const etId = (name: string) => eventTypes.find((e) => e.name === name)?.id;
    const ET_GOAL = etId("goal")!;
    const ET_ASSIST = etId("assist");
    const ET_OWN_GOAL = etId("own_goal")!;
    const ET_PENALTY = etId("penalty_goal")!;
    const ET_YELLOW = etId("yellow_card")!;
    const ET_RED = etId("red_card")!;

    if (!ET_GOAL || !ET_YELLOW || !ET_RED) {
        throw new Error("Required event types not found. Run base seed first.");
    }

    // ── Fetch all matches in rounds 1–32 ──────────────────────────────────────
    const matches = await prisma.match.findMany({
        where: {
            seasonId: SEASON_ID,
            roundNumber: { gte: 1, lte: MAX_ROUNDS },
        },
        include: {
            homeClub: true,
            awayClub: true,
        },
        orderBy: [{ roundNumber: "asc" }, { matchDate: "asc" }],
    });

    console.log(`   Found ${matches.length} matches in rounds 1–${MAX_ROUNDS}\n`);
    if (matches.length === 0) {
        console.log("   ⚠️  No matches found. Generate fixtures first.");
        return;
    }

    // ── Fetch all SeasonClubPlayers for this season ────────────────────────────
    const allSCPs = await prisma.seasonClubPlayer.findMany({
        where: {
            seasonClub: { seasonId: SEASON_ID },
            status: "active",
            requestStatus: "approved",
        },
        include: {
            player: true,
            position: true,
            seasonClub: { select: { clubId: true } },
        },
    });

    // Group by clubId
    const scpByClub = new Map<string, typeof allSCPs>();
    for (const scp of allSCPs) {
        const cid = scp.seasonClub.clubId;
        if (!scpByClub.has(cid)) scpByClub.set(cid, []);
        scpByClub.get(cid)!.push(scp);
    }

    // ── Process each match ─────────────────────────────────────────────────────
    let processed = 0;
    let skipped = 0;

    for (const match of matches) {
        // Skip already-completed matches
        if (match.status === "completed") {
            skipped++;
            continue;
        }

        // Deterministic seed from match id (first 8 hex chars → int)
        const seed = parseInt(match.id.replace(/-/g, "").slice(0, 8), 16);
        const rand = makePrng(seed);

        const homeSCPs = scpByClub.get(match.homeClubId) ?? [];
        const awaySCPs = scpByClub.get(match.awayClubId) ?? [];

        if (homeSCPs.length === 0 || awaySCPs.length === 0) {
            console.log(`   ⚠️  Skipping match ${match.id} — missing squad data`);
            skipped++;
            continue;
        }

        // ── 1. Build lineups ────────────────────────────────────────────────────
        // Sort: GK first, then outfield by position priority
        const sortSCPs = (scps: typeof allSCPs) => {
            const gks = scps.filter((s) => s.position?.code === GK_CODE);
            const outfield = scps.filter((s) => s.position?.code !== GK_CODE);
            return [...gks, ...outfield];
        };

        const homeSorted = sortSCPs(homeSCPs);
        const awaySorted = sortSCPs(awaySCPs);

        const homeStarters = homeSorted.slice(0, 11);
        const homeBench = homeSorted.slice(11, 18);
        const awayStarters = awaySorted.slice(0, 11);
        const awayBench = awaySorted.slice(11, 18);

        // Delete any existing lineups/events for this match (idempotent)
        await prisma.matchLineup.deleteMany({ where: { matchId: match.id } });
        await prisma.matchEvent.deleteMany({ where: { matchId: match.id } });

        // Create lineups
        const lineupRows = [
            ...homeStarters.map((scp, i) => ({
                matchId: match.id,
                seasonClubPlayerId: scp.id,
                positionId: scp.positionId ?? null,
                lineupType: "starting" as const,
                shirtNumber: scp.jerseyNumber ?? (i + 1),
                isCaptain: i === 0,
            })),
            ...homeBench.map((scp, i) => ({
                matchId: match.id,
                seasonClubPlayerId: scp.id,
                positionId: scp.positionId ?? null,
                lineupType: "bench" as const,
                shirtNumber: scp.jerseyNumber ?? (12 + i),
                isCaptain: false,
            })),
            ...awayStarters.map((scp, i) => ({
                matchId: match.id,
                seasonClubPlayerId: scp.id,
                positionId: scp.positionId ?? null,
                lineupType: "starting" as const,
                shirtNumber: scp.jerseyNumber ?? (i + 1),
                isCaptain: i === 0,
            })),
            ...awayBench.map((scp, i) => ({
                matchId: match.id,
                seasonClubPlayerId: scp.id,
                positionId: scp.positionId ?? null,
                lineupType: "bench" as const,
                shirtNumber: scp.jerseyNumber ?? (12 + i),
                isCaptain: false,
            })),
        ];

        await prisma.matchLineup.createMany({ data: lineupRows, skipDuplicates: true });

        // ── 2. Simulate scoreline ───────────────────────────────────────────────
        const { home: homeGoals, away: awayGoals } = simulateGoals(rand);
        const { yellows, reds } = simulateCards(rand);

        // ── 3. Create match events ──────────────────────────────────────────────
        const events: Array<{
            matchId: string;
            eventTypeId: number;
            playerId: string;
            relatedPlayerId?: string | null;
            clubId: string;
            minute: number;
            extraTime?: number | null;
            description?: string | null;
        }> = [];

        // Helper: pick a forward/attacker preferentially for goals
        const pickScorer = (scps: typeof allSCPs, rand: () => number) => {
            const forwards = scps.filter((s) => s.position?.code && FORWARD_CODES.has(s.position.code));
            const pool = forwards.length > 0 ? forwards : scps;
            return pickRandom(rand, pool);
        };

        const pickAssister = (scps: typeof allSCPs, scorerId: string, rand: () => number) => {
            const others = scps.filter((s) => s.player.id !== scorerId);
            if (others.length === 0) return null;
            return rand() < 0.65 ? pickRandom(rand, others) : null; // 65% chance of assist
        };

        // Goal minutes — spread across 90 mins, slight clustering in 30-90
        const totalGoals = homeGoals + awayGoals;
        const goalMinutes = assignMinutes(rand, totalGoals, 90);

        let homeGoalIdx = 0;
        let awayGoalIdx = 0;

        for (let gi = 0; gi < totalGoals; gi++) {
            const minute = goalMinutes[gi];
            const isHome = gi < homeGoals; // first homeGoals events are home goals
            const scoringScps = isHome ? homeStarters : awayStarters;
            const clubId = isHome ? match.homeClubId : match.awayClubId;

            // Rare own goal (~5%)
            const isOwnGoal = rand() < 0.05;
            // Rare penalty (~15%)
            const isPenalty = !isOwnGoal && rand() < 0.15;

            const scorer = pickScorer(scoringScps, rand);
            const assister = !isOwnGoal && !isPenalty ? pickAssister(scoringScps, scorer.player.id, rand) : null;

            events.push({
                matchId: match.id,
                eventTypeId: isOwnGoal ? ET_OWN_GOAL : isPenalty ? ET_PENALTY : ET_GOAL,
                playerId: scorer.player.id,
                relatedPlayerId: assister?.player.id ?? null,
                clubId,
                minute,
                description: isOwnGoal ? "Own goal" : isPenalty ? "Penalty" : null,
            });

            if (assister && ET_ASSIST) {
                events.push({
                    matchId: match.id,
                    eventTypeId: ET_ASSIST,
                    playerId: assister.player.id,
                    relatedPlayerId: scorer.player.id,
                    clubId,
                    minute,
                });
            }
        }

        // Yellow cards — spread across both teams
        const yellowMinutes = assignMinutes(rand, yellows, 90);
        const allStartersForCards = [...homeStarters, ...awayStarters];
        const usedForYellow = new Set<string>();

        for (let yi = 0; yi < yellows; yi++) {
            // Pick a player who hasn't already got a yellow this match
            const eligible = allStartersForCards.filter((s) => !usedForYellow.has(s.player.id));
            if (eligible.length === 0) break;
            const player = pickRandom(rand, eligible);
            usedForYellow.add(player.player.id);
            const clubId = homeStarters.includes(player) ? match.homeClubId : match.awayClubId;
            events.push({
                matchId: match.id,
                eventTypeId: ET_YELLOW,
                playerId: player.player.id,
                clubId,
                minute: yellowMinutes[yi],
            });
        }

        // Red cards — very rare, pick from players not already red-carded
        const redMinutes = assignMinutes(rand, reds, 90);
        const usedForRed = new Set<string>();

        for (let ri = 0; ri < reds; ri++) {
            const eligible = allStartersForCards.filter(
                (s) => !usedForRed.has(s.player.id) && !usedForYellow.has(s.player.id)
            );
            if (eligible.length === 0) break;
            const player = pickRandom(rand, eligible);
            usedForRed.add(player.player.id);
            const clubId = homeStarters.includes(player) ? match.homeClubId : match.awayClubId;
            events.push({
                matchId: match.id,
                eventTypeId: ET_RED,
                playerId: player.player.id,
                clubId,
                minute: redMinutes[ri],
            });
        }

        // Insert events
        if (events.length > 0) {
            await prisma.matchEvent.createMany({ data: events, skipDuplicates: true });
        }

        // ── 4. Update match score + status ──────────────────────────────────────
        await prisma.match.update({
            where: { id: match.id },
            data: {
                homeScore: homeGoals,
                awayScore: awayGoals,
                status: "completed",
            },
        });

        processed++;
        if (processed % 10 === 0 || processed <= 5) {
            console.log(
                `   [R${String(match.roundNumber).padStart(2, "0")}] ${match.homeClub.name.padEnd(28)} ${homeGoals}-${awayGoals} ${match.awayClub.name.padEnd(28)} | Y:${yellows} R:${reds}`
            );
        }
    }

    // ── Summary ────────────────────────────────────────────────────────────────
    const totalEvents = await prisma.matchEvent.count({ where: { match: { seasonId: SEASON_ID } } });
    const totalLineups = await prisma.matchLineup.count({ where: { match: { seasonId: SEASON_ID } } });
    const completedMatches = await prisma.match.count({ where: { seasonId: SEASON_ID, status: "completed" } });

    console.log("\n" + "═".repeat(70));
    console.log("🎉  Done!\n");
    console.log(`  Matches processed : ${processed}`);
    console.log(`  Matches skipped   : ${skipped}`);
    console.log(`  Completed matches : ${completedMatches}`);
    console.log(`  Lineup entries    : ${totalLineups}`);
    console.log(`  Match events      : ${totalEvents}`);
    console.log("═".repeat(70));
}

main()
    .catch((e) => { console.error("\n❌  Failed:", e); process.exit(1); })
    .finally(() => prisma.$disconnect());
