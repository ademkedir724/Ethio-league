/**
 * seed-higher-league-a-season.ts  —  Phase 3 + Phase 4
 *
 * Phase 3: Create 2025/26 season, register all 10 clubs,
 *          register all 200 players (approved), create 1 head coach per club (approved)
 *
 * Phase 4: Reuse existing EFF referees + MEA users (already at org level).
 *          No new referees/MEAs needed — they are org-scoped and available
 *          for assignment via the Assignments UI.
 *          (For a 10-club season: 5 matches/round → need 6 MEAs + 24 referees max)
 *
 * Run with:  npx tsx prisma/seed-higher-league-a-season.ts
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
const LICENSE_LEVELS = ["FIFA", "CAF", "National A", "National B", "National C", "Regional"];

async function main() {
    console.log("\n🌱  EHLA Group A — Phase 3 + Phase 4\n");

    // ── Resolve league ─────────────────────────────────────────────────────────
    const league = await prisma.league.findFirst({
        where: { name: LEAGUE_NAME },
        include: { organization: true },
    });
    if (!league) throw new Error(`League "${LEAGUE_NAME}" not found. Run Phase 1+2 first.`);
    console.log(`✅  League: ${league.name}  (${league.id})`);
    console.log(`   Org   : ${league.organization.name}  (${league.organizationId})\n`);

    const orgId = league.organizationId;

    // ── Fetch all clubs in this league ────────────────────────────────────────
    const clubs = await prisma.club.findMany({
        where: { leagueId: league.id },
        include: { players: true },
        orderBy: { createdAt: "asc" },
    });
    if (clubs.length === 0) throw new Error("No clubs found. Run Phase 2 first.");
    console.log(`   Found ${clubs.length} clubs\n`);

    // ── Pre-fetch positions ────────────────────────────────────────────────────
    const allPositions = await prisma.position.findMany({ select: { id: true, code: true } });
    const positionIds: Record<string, number | null> = {};
    for (const p of allPositions) positionIds[p.code] = p.id;

    // ══════════════════════════════════════════════════════════════════════════
    // PHASE 3 — Season + SeasonClubs + SeasonClubPlayers + SeasonClubCoaches
    // ══════════════════════════════════════════════════════════════════════════
    console.log("── Phase 3: Season + Squad Registration ─────────────────────────\n");

    // Create season
    const existingSeason = await prisma.season.findFirst({
        where: { leagueId: league.id, name: "2025/26" },
    });

    const season = existingSeason ?? await prisma.season.create({
        data: {
            leagueId: league.id,
            name: "2025/26",
            startDate: new Date("2025-09-01"),
            endDate: new Date("2026-05-31"),
            status: "upcoming",
            requiredClubs: 10,
            roundRobinType: "double",
            daysBetweenRounds: 7,
            pointsWin: 3,
            pointsDraw: 1,
            pointsLoss: 0,
            minSquadSize: 14,
            minStartingPlayers: 11,
            maxBenchPlayers: 7,
            rules:
                "Ethiopian Higher League Group A 2025/26 season rules: " +
                "Double round-robin format. Top 2 clubs promoted to Ethiopian Premier League. " +
                "Bottom 2 clubs relegated. Standard FIFA rules apply.",
        },
    });

    const isNew = !existingSeason;
    console.log(`   ${isNew ? "✅  Created" : "ℹ️   Found existing"} season: "${season.name}"  (${season.id})`);

    // Register clubs + players + coaches
    let totalPlayers = 0;
    let totalCoaches = 0;

    for (const [ci, club] of clubs.entries()) {
        // SeasonClub
        let seasonClub = await prisma.seasonClub.findUnique({
            where: { seasonId_clubId: { seasonId: season.id, clubId: club.id } },
        });
        if (!seasonClub) {
            seasonClub = await prisma.seasonClub.create({
                data: { seasonId: season.id, clubId: club.id, status: "active" },
            });
        } else if (seasonClub.status !== "active") {
            seasonClub = await prisma.seasonClub.update({
                where: { id: seasonClub.id },
                data: { status: "active" },
            });
        }

        // SeasonClubPlayers — all 20 players, approved + active
        let addedPlayers = 0;
        for (const [pi, player] of club.players.entries()) {
            const existing = await prisma.seasonClubPlayer.findUnique({
                where: { seasonClubId_playerId: { seasonClubId: seasonClub.id, playerId: player.id } },
            });
            if (!existing) {
                await prisma.seasonClubPlayer.create({
                    data: {
                        seasonClubId: seasonClub.id,
                        playerId: player.id,
                        jerseyNumber: pi + 1,
                        positionId: player.primaryPositionId ?? null,
                        status: "active",
                        requestStatus: "approved",
                        playerRole: pi === 0 ? "goalkeeper" : pi < 5 ? "defender" : pi < 9 ? "midfielder" : "forward",
                    },
                });
                addedPlayers++;
            }
        }
        totalPlayers += addedPlayers;

        // SeasonClubCoach — one head coach per club
        const existingCoach = await prisma.seasonClubCoach.findFirst({
            where: { seasonClubId: seasonClub.id },
        });
        let addedCoach = 0;
        if (!existingCoach) {
            // Create a coach record for this club
            const coachNames = [
                { firstName: "Tesfaye", lastName: "Bekele" },
                { firstName: "Girma", lastName: "Haile" },
                { firstName: "Dawit", lastName: "Tadesse" },
                { firstName: "Mulugeta", lastName: "Alemu" },
                { firstName: "Henok", lastName: "Gebre" },
                { firstName: "Yonas", lastName: "Negash" },
                { firstName: "Amanuel", lastName: "Worku" },
                { firstName: "Biruk", lastName: "Demeke" },
                { firstName: "Ermias", lastName: "Kebede" },
                { firstName: "Fasil", lastName: "Eshetu" },
            ];
            const cn = coachNames[ci % coachNames.length];
            const coach = await prisma.coach.create({
                data: {
                    firstName: cn.firstName,
                    lastName: cn.lastName,
                    nationality: "Ethiopian",
                    licenseLevel: LICENSE_LEVELS[ci % LICENSE_LEVELS.length],
                    experienceYears: 5 + (ci % 15),
                    status: "active",
                    clubId: club.id,
                },
            });
            await prisma.seasonClubCoach.create({
                data: {
                    seasonClubId: seasonClub.id,
                    coachId: coach.id,
                    role: "head_coach",
                    startDate: season.startDate,
                    status: "active",
                    requestStatus: "approved",
                },
            });
            addedCoach = 1;
        }
        totalCoaches += addedCoach;

        console.log(
            `   [${String(ci + 1).padStart(2, "0")}] ${club.name.padEnd(28)} | +${addedPlayers} players | +${addedCoach} coach`
        );
    }

    console.log(`\n   ✅  Players registered : ${totalPlayers}`);
    console.log(`   ✅  Coaches registered : ${totalCoaches}`);

    // ══════════════════════════════════════════════════════════════════════════
    // PHASE 4 — Referees + MEA availability check
    // ══════════════════════════════════════════════════════════════════════════
    console.log("\n── Phase 4: Referees + MEA Availability ─────────────────────────\n");

    const refereeCount = await prisma.referee.count();
    const meaRoleId = (await prisma.role.findUniqueOrThrow({ where: { name: "match_event_admin" } })).id;
    const meaCount = await prisma.userRoleScope.count({
        where: { roleId: meaRoleId, organizationId: orgId },
    });

    // For 10 clubs: 5 matches/round → need max 6 MEAs and 24 referees
    const matchesPerRound = 5;
    const neededMEAs = matchesPerRound + 1;      // 6
    const neededReferees = (matchesPerRound + 1) * 4; // 24

    console.log(`   EFF referees available : ${refereeCount}  (need ${neededReferees} for this season)`);
    console.log(`   EFF MEA users available: ${meaCount}  (need ${neededMEAs} for this season)`);

    if (refereeCount >= neededReferees) {
        console.log("   ✅  Enough referees — assign them via the Assignments page");
    } else {
        console.log(`   ⚠️   Only ${refereeCount} referees — need ${neededReferees}. Consider adding more.`);
    }

    if (meaCount >= neededMEAs) {
        console.log("   ✅  Enough MEAs — assign them via the Assignments page");
    } else {
        console.log(`   ⚠️   Only ${meaCount} MEAs — need ${neededMEAs}. Consider adding more.`);
    }

    // ── Summary ────────────────────────────────────────────────────────────────
    const scpCount = await prisma.seasonClubPlayer.count({ where: { seasonClub: { seasonId: season.id } } });
    const sccCount = await prisma.seasonClubCoach.count({ where: { seasonClub: { seasonId: season.id } } });

    console.log("\n" + "=".repeat(65));
    console.log("Phase 3 + Phase 4 complete!\n");
    console.log("  Season         : 2025/26 EHLA Group A");
    console.log("  Season ID      : " + season.id);
    console.log("  Season status  : " + season.status);
    console.log("  Clubs in season: " + clubs.length);
    console.log("  Players (approved): " + scpCount);
    console.log("  Coaches (approved): " + sccCount);
    console.log("  Referees (org) : " + refereeCount);
    console.log("  MEAs (org)     : " + meaCount);
    console.log("\n  Next steps:");
    console.log("  1. Activate the season from the dashboard");
    console.log("  2. Assign referees + MEAs via the Assignments page");
    console.log("  3. Generate fixtures from the season page");
    console.log("  4. Run seed-matches.ts with SEASON_ID=" + season.id);
    console.log("=".repeat(65));
}

main()
    .catch((e) => { console.error("\n  Failed:", e); process.exit(1); })
    .finally(() => prisma.$disconnect());
