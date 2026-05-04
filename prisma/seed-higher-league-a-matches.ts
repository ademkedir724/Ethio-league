/**
 * seed-higher-league-a-matches.ts  —  Phase 5
 *
 * For the EHLA Group A 2025/26 season:
 *  1. Activates the season (status → active)
 *  2. Generates a single round-robin fixture schedule (rounds 1–9 for 10 clubs)
 *     using the standard Berger table algorithm — each club plays every other once
 *     That gives 9 rounds × 5 matches = 45 matches total for single round-robin
 *     We only simulate rounds 1–15 (double round-robin first 15 rounds)
 *  3. For each match in rounds 1–15:
 *     - Builds lineups from active SeasonClubPlayers
 *     - Simulates realistic scoreline (avg ~2.5 goals, max 6, 0-0 possible)
 *     - Creates MatchEvent records (goals, assists, yellows, reds)
 *     - Sets match status → "completed"
 *
 * Run with:  npx tsx prisma/seed-higher-league-a-matches.ts
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

const LEAGUE_NAME = "Ethiopian Higher League Group A";
const SEASON_NAME = "2025/26";
const MAX_ROUNDS = 15;

// ─── Seeded PRNG ──────────────────────────────────────────────────────────────
function makePrng(seed: number) {
    let s = seed >>> 0;
    return function rand(): number {
        s += 0x6d2b79f5;
        let t = Math.imul(s ^ (s >>> 15), 1 | s);
        t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}
function randInt(rand: () => number, min: number, max: number) {
    return Math.floor(rand() * (max - min + 1)) + min;
}
function pickRandom<T>(rand: () => number, arr: T[]): T {
    return arr[Math.floor(rand() * arr.length)];
}

// ─── Weighted pick ────────────────────────────────────────────────────────────
function weightedPick(rand: () => number, weights: number[]): number {
    const total = weights.reduce((a, b) => a + b, 0);
    let r = rand() * total;
    for (let i = 0; i < weights.length; i++) {
        r -= weights[i];
        if (r <= 0) return i;
    }
    return weights.length - 1;
}

// ─── Simulate goals ───────────────────────────────────────────────────────────
function simulateGoals(rand: () => number): { home: number; away: number } {
    const weights = [8, 14, 22, 22, 16, 10, 5, 3]; // 0..7 total goals
    const total = weightedPick(rand, weights);
    if (total === 0) return { home: 0, away: 0 };
    let home = 0, away = 0;
    for (let i = 0; i < total; i++) {
        if (rand() < 0.55) home++; else away++;
    }
    return { home, away };
}

// ─── Simulate cards ───────────────────────────────────────────────────────────
function simulateCards(rand: () => number): { yellows: number; reds: number } {
    const yellows = weightedPick(rand, [5, 15, 25, 25, 18, 12]); // 0..5
    const reds = weightedPick(rand, [70, 22, 6, 2]);           // 0..3
    return { yellows, reds };
}

// ─── Assign minutes ───────────────────────────────────────────────────────────
function assignMinutes(rand: () => number, count: number): number[] {
    return Array.from({ length: count }, () => randInt(rand, 1, 90)).sort((a, b) => a - b);
}

// ─── Berger round-robin schedule ─────────────────────────────────────────────
// Returns rounds array: each round is an array of [homeIdx, awayIdx] pairs
function bergerSchedule(n: number): Array<Array<[number, number]>> {
    // If odd, add a dummy "bye" team
    const teams = Array.from({ length: n % 2 === 0 ? n : n + 1 }, (_, i) => i);
    const numRounds = teams.length - 1;
    const half = teams.length / 2;
    const rounds: Array<Array<[number, number]>> = [];

    for (let r = 0; r < numRounds; r++) {
        const round: Array<[number, number]> = [];
        for (let i = 0; i < half; i++) {
            const home = teams[i];
            const away = teams[teams.length - 1 - i];
            if (home < n && away < n) { // skip bye matches
                round.push(r % 2 === 0 ? [home, away] : [away, home]);
            }
        }
        rounds.push(round);
        // Rotate all except first element
        const last = teams.pop()!;
        teams.splice(1, 0, last);
    }
    return rounds;
}

// ─── Position helpers ─────────────────────────────────────────────────────────
const FORWARD_CODES = new Set(["ST", "CF", "LW", "RW", "CAM"]);

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
    console.log(`\n⚽  Phase 5 — EHLA Group A fixtures + match simulation (rounds 1–${MAX_ROUNDS})\n`);

    // ── Resolve season ─────────────────────────────────────────────────────────
    const league = await prisma.league.findFirst({ where: { name: LEAGUE_NAME } });
    if (!league) throw new Error(`League "${LEAGUE_NAME}" not found.`);

    const season = await prisma.season.findFirst({
        where: { leagueId: league.id, name: SEASON_NAME },
    });
    if (!season) throw new Error(`Season "${SEASON_NAME}" not found. Run Phase 3 first.`);
    console.log(`✅  Season: "${season.name}"  (${season.id})  status: ${season.status}`);

    // ── Activate season if needed ──────────────────────────────────────────────
    if (season.status !== "active") {
        await prisma.season.update({ where: { id: season.id }, data: { status: "active" } });
        console.log("   ✅  Season activated");
    }

    // ── Fetch clubs in season ──────────────────────────────────────────────────
    const seasonClubs = await prisma.seasonClub.findMany({
        where: { seasonId: season.id, status: "active" },
        include: { club: true },
        orderBy: { createdAt: "asc" },
    });
    if (seasonClubs.length === 0) throw new Error("No clubs in season. Run Phase 3 first.");
    console.log(`   Found ${seasonClubs.length} clubs in season\n`);

    const clubIds = seasonClubs.map((sc) => sc.clubId);
    const n = clubIds.length; // 10

    // ── Fetch event types ──────────────────────────────────────────────────────
    const eventTypes = await prisma.eventType.findMany();
    const etId = (name: string) => eventTypes.find((e) => e.name === name)?.id;
    const ET_GOAL = etId("goal")!;
    const ET_ASSIST = etId("assist");
    const ET_OWN_GOAL = etId("own_goal")!;
    const ET_PENALTY = etId("penalty_goal")!;
    const ET_YELLOW = etId("yellow_card")!;
    const ET_RED = etId("red_card")!;
    if (!ET_GOAL || !ET_YELLOW || !ET_RED) throw new Error("Event types missing. Run base seed first.");

    // ── Fetch all active SeasonClubPlayers ────────────────────────────────────
    const allSCPs = await prisma.seasonClubPlayer.findMany({
        where: { seasonClub: { seasonId: season.id }, status: "active", requestStatus: "approved" },
        include: { player: true, position: true, seasonClub: { select: { clubId: true } } },
    });
    const scpByClub = new Map<string, typeof allSCPs>();
    for (const scp of allSCPs) {
        const cid = scp.seasonClub.clubId;
        if (!scpByClub.has(cid)) scpByClub.set(cid, []);
        scpByClub.get(cid)!.push(scp);
    }

    // ── Generate Berger schedule ───────────────────────────────────────────────
    const schedule = bergerSchedule(n); // 9 rounds for 10 clubs (single RR)
    // For double round-robin up to 15 rounds: use single RR twice with home/away swapped
    const fullSchedule: Array<Array<[number, number]>> = [];
    for (const round of schedule) fullSchedule.push(round);
    for (const round of schedule) fullSchedule.push(round.map(([h, a]) => [a, h] as [number, number]));
    // fullSchedule now has 18 rounds; we take first MAX_ROUNDS
    const roundsToPlay = fullSchedule.slice(0, MAX_ROUNDS);

    // ── Check for existing matches ─────────────────────────────────────────────
    const existingMatches = await prisma.match.findMany({
        where: { seasonId: season.id },
        select: { id: true, roundNumber: true, homeClubId: true, awayClubId: true, status: true },
    });
    const existingMatchKeys = new Set(
        existingMatches.map((m) => `${m.roundNumber}:${m.homeClubId}:${m.awayClubId}`)
    );
    console.log(`   Existing matches in DB: ${existingMatches.length}`);

    // ── Process rounds ─────────────────────────────────────────────────────────
    let created = 0;
    let simulated = 0;
    let skipped = 0;

    const seasonStart = new Date(season.startDate);

    for (let ri = 0; ri < roundsToPlay.length; ri++) {
        const roundNumber = ri + 1;
        const roundDate = new Date(seasonStart);
        roundDate.setDate(roundDate.getDate() + ri * 7); // 1 week apart

        for (const [homeIdx, awayIdx] of roundsToPlay[ri]) {
            const homeClubId = clubIds[homeIdx];
            const awayClubId = clubIds[awayIdx];
            const matchKey = `${roundNumber}:${homeClubId}:${awayClubId}`;

            // Find or create match
            let match = existingMatches.find(
                (m) => m.roundNumber === roundNumber && m.homeClubId === homeClubId && m.awayClubId === awayClubId
            );

            if (!match) {
                const kickoff = new Date(roundDate);
                kickoff.setHours(15 + (homeIdx % 3) * 2, 0, 0, 0); // stagger kickoffs
                const created_match = await prisma.match.create({
                    data: {
                        seasonId: season.id,
                        homeClubId,
                        awayClubId,
                        matchDate: kickoff,
                        roundNumber,
                        status: "scheduled",
                        homeScore: 0,
                        awayScore: 0,
                    },
                    select: { id: true, roundNumber: true, homeClubId: true, awayClubId: true, status: true },
                });
                match = created_match;
                created++;
            }

            // Skip already completed
            if (match.status === "completed") { skipped++; continue; }

            // ── Lineups ────────────────────────────────────────────────────────────
            const homeSCPs = scpByClub.get(homeClubId) ?? [];
            const awaySCPs = scpByClub.get(awayClubId) ?? [];
            if (homeSCPs.length === 0 || awaySCPs.length === 0) { skipped++; continue; }

            const sortSCPs = (scps: typeof allSCPs) => {
                const gks = scps.filter((s) => s.position?.code === "GK");
                const out = scps.filter((s) => s.position?.code !== "GK");
                return [...gks, ...out];
            };
            const homeStarters = sortSCPs(homeSCPs).slice(0, 11);
            const homeBench = sortSCPs(homeSCPs).slice(11, 18);
            const awayStarters = sortSCPs(awaySCPs).slice(0, 11);
            const awayBench = sortSCPs(awaySCPs).slice(11, 18);

            await prisma.matchLineup.deleteMany({ where: { matchId: match.id } });
            await prisma.matchEvent.deleteMany({ where: { matchId: match.id } });

            const lineupRows = [
                ...homeStarters.map((scp, i) => ({ matchId: match!.id, seasonClubPlayerId: scp.id, positionId: scp.positionId ?? null, lineupType: "starting", shirtNumber: scp.jerseyNumber ?? (i + 1), isCaptain: i === 0 })),
                ...homeBench.map((scp, i) => ({ matchId: match!.id, seasonClubPlayerId: scp.id, positionId: scp.positionId ?? null, lineupType: "bench", shirtNumber: scp.jerseyNumber ?? (12 + i), isCaptain: false })),
                ...awayStarters.map((scp, i) => ({ matchId: match!.id, seasonClubPlayerId: scp.id, positionId: scp.positionId ?? null, lineupType: "starting", shirtNumber: scp.jerseyNumber ?? (i + 1), isCaptain: i === 0 })),
                ...awayBench.map((scp, i) => ({ matchId: match!.id, seasonClubPlayerId: scp.id, positionId: scp.positionId ?? null, lineupType: "bench", shirtNumber: scp.jerseyNumber ?? (12 + i), isCaptain: false })),
            ];
            await prisma.matchLineup.createMany({ data: lineupRows, skipDuplicates: true });

            // ── Simulate ───────────────────────────────────────────────────────────
            const seed = parseInt(match.id.replace(/-/g, "").slice(0, 8), 16);
            const rand = makePrng(seed);
            const { home: homeGoals, away: awayGoals } = simulateGoals(rand);
            const { yellows, reds } = simulateCards(rand);

            const events: Array<{
                matchId: string; eventTypeId: number; playerId: string;
                relatedPlayerId?: string | null; clubId: string; minute: number; description?: string | null;
            }> = [];

            // Goals
            const totalGoals = homeGoals + awayGoals;
            const goalMinutes = assignMinutes(rand, totalGoals);
            for (let gi = 0; gi < totalGoals; gi++) {
                const isHome = gi < homeGoals;
                const scoringScps = isHome ? homeStarters : awayStarters;
                const clubId = isHome ? homeClubId : awayClubId;
                const forwards = scoringScps.filter((s) => s.position?.code && FORWARD_CODES.has(s.position.code));
                const pool = forwards.length > 0 ? forwards : scoringScps;
                const scorer = pickRandom(rand, pool);
                const isOwnGoal = rand() < 0.05;
                const isPenalty = !isOwnGoal && rand() < 0.15;
                const others = scoringScps.filter((s) => s.player.id !== scorer.player.id);
                const assister = !isOwnGoal && !isPenalty && others.length > 0 && rand() < 0.65
                    ? pickRandom(rand, others) : null;

                events.push({ matchId: match.id, eventTypeId: isOwnGoal ? ET_OWN_GOAL : isPenalty ? ET_PENALTY : ET_GOAL, playerId: scorer.player.id, relatedPlayerId: assister?.player.id ?? null, clubId, minute: goalMinutes[gi], description: isOwnGoal ? "Own goal" : isPenalty ? "Penalty" : null });
                if (assister && ET_ASSIST) {
                    events.push({ matchId: match.id, eventTypeId: ET_ASSIST, playerId: assister.player.id, relatedPlayerId: scorer.player.id, clubId, minute: goalMinutes[gi] });
                }
            }

            // Yellow cards
            const allStarters = [...homeStarters, ...awayStarters];
            const yellowMinutes = assignMinutes(rand, yellows);
            const usedYellow = new Set<string>();
            for (let yi = 0; yi < yellows; yi++) {
                const eligible = allStarters.filter((s) => !usedYellow.has(s.player.id));
                if (eligible.length === 0) break;
                const p = pickRandom(rand, eligible);
                usedYellow.add(p.player.id);
                events.push({ matchId: match.id, eventTypeId: ET_YELLOW, playerId: p.player.id, clubId: homeStarters.includes(p) ? homeClubId : awayClubId, minute: yellowMinutes[yi] });
            }

            // Red cards
            const redMinutes = assignMinutes(rand, reds);
            const usedRed = new Set<string>();
            for (let ri2 = 0; ri2 < reds; ri2++) {
                const eligible = allStarters.filter((s) => !usedRed.has(s.player.id) && !usedYellow.has(s.player.id));
                if (eligible.length === 0) break;
                const p = pickRandom(rand, eligible);
                usedRed.add(p.player.id);
                events.push({ matchId: match.id, eventTypeId: ET_RED, playerId: p.player.id, clubId: homeStarters.includes(p) ? homeClubId : awayClubId, minute: redMinutes[ri2] });
            }

            if (events.length > 0) await prisma.matchEvent.createMany({ data: events, skipDuplicates: true });

            await prisma.match.update({
                where: { id: match.id },
                data: { homeScore: homeGoals, awayScore: awayGoals, status: "completed" },
            });

            simulated++;
        }

        const roundMatches = roundsToPlay[ri];
        console.log(`   Round ${String(roundNumber).padStart(2, "0")} — ${roundMatches.length} matches simulated`);
    }

    // ── Summary ────────────────────────────────────────────────────────────────
    const completedCount = await prisma.match.count({ where: { seasonId: season.id, status: "completed" } });
    const eventCount = await prisma.matchEvent.count({ where: { match: { seasonId: season.id } } });
    const lineupCount = await prisma.matchLineup.count({ where: { match: { seasonId: season.id } } });

    console.log("\n" + "=".repeat(65));
    console.log("Phase 5 complete!\n");
    console.log("  Season         : " + season.name + " EHLA Group A");
    console.log("  Rounds played  : " + MAX_ROUNDS);
    console.log("  Matches created: " + created);
    console.log("  Matches simulated: " + simulated);
    console.log("  Matches skipped: " + skipped);
    console.log("  Completed total: " + completedCount);
    console.log("  Lineup entries : " + lineupCount);
    console.log("  Match events   : " + eventCount);
    console.log("=".repeat(65));
}

main()
    .catch((e) => { console.error("\n  Failed:", e); process.exit(1); })
    .finally(() => prisma.$disconnect());
