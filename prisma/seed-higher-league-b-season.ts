/**
 * seed-higher-league-b-season.ts  —  Phase 3 + Phase 4
 *
 * Phase 3: Create 2025/26 season for EHLA Group B,
 *          register all 10 clubs, 200 players (approved), 1 head coach per club (approved)
 *
 * Phase 4: Verify existing EFF referees + MEA users are sufficient
 *          (44 refs and 11 MEAs already exist at org level)
 *
 * Run with:  npx tsx prisma/seed-higher-league-b-season.ts
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

const LEAGUE_NAME = "Ethiopian Higher League Group B";
const LICENSE_LEVELS = ["FIFA", "CAF", "National A", "National B", "National C", "Regional"];

const COACH_NAMES = [
    { firstName: "Tesfaye", lastName: "Worku" },
    { firstName: "Girma", lastName: "Tadesse" },
    { firstName: "Dawit", lastName: "Bekele" },
    { firstName: "Mulugeta", lastName: "Haile" },
    { firstName: "Henok", lastName: "Alemu" },
    { firstName: "Yonas", lastName: "Gebre" },
    { firstName: "Amanuel", lastName: "Negash" },
    { firstName: "Biruk", lastName: "Eshetu" },
    { firstName: "Ermias", lastName: "Demeke" },
    { firstName: "Fasil", lastName: "Kebede" },
];

async function main() {
    console.log("\n🌱  EHLA Group B — Phase 3 + Phase 4\n");

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

    // ══════════════════════════════════════════════════════════════════════════
    // PHASE 3 — Season + SeasonClubs + SeasonClubPlayers + SeasonClubCoaches
    // ══════════════════════════════════════════════════════════════════════════
    console.log("── Phase 3: Season + Squad Registration ─────────────────────────\n");

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
                "Ethiopian Higher League Group B 2025/26 season rules: " +
                "Double round-robin format. Top 2 clubs promoted to Ethiopian Premier League. " +
                "Bottom 2 clubs relegated. Standard FIFA rules apply.",
        },
    });

    console.log(`   ${!existingSeason ? "✅  Created" : "ℹ️   Found existing"} season: "${season.name}"  (${season.id})`);

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

        // SeasonClubPlayers
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

        // SeasonClubCoach
        const existingCoach = await prisma.seasonClubCoach.findFirst({
            where: { seasonClubId: seasonClub.id },
        });
        let addedCoach = 0;
        if (!existingCoach) {
            const cn = COACH_NAMES[ci % COACH_NAMES.length];
            const coach = await prisma.coach.create({
                data: {
                    firstName: cn.firstName,
                    lastName: cn.lastName,
                    nationality: "Ethiopian",
                    licenseLevel: LICENSE_LEVELS[ci % LICENSE_LEVELS.length],
                    experienceYears: 4 + (ci % 16),
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

    // 10 clubs → 5 matches/round → need 6 MEAs and 24 referees
    const neededMEAs = 6;
    const neededReferees = 24;

    console.log(`   EFF referees available : ${refereeCount}  (need ${neededReferees})`);
    console.log(`   EFF MEA users available: ${meaCount}  (need ${neededMEAs})`);
    console.log(refereeCount >= neededReferees ? "   ✅  Enough referees" : `   ⚠️   Need ${neededReferees - refereeCount} more referees`);
    console.log(meaCount >= neededMEAs ? "   ✅  Enough MEAs" : `   ⚠️   Need ${neededMEAs - meaCount} more MEAs`);

    // ── Summary ────────────────────────────────────────────────────────────────
    const scpCount = await prisma.seasonClubPlayer.count({ where: { seasonClub: { seasonId: season.id } } });
    const sccCount = await prisma.seasonClubCoach.count({ where: { seasonClub: { seasonId: season.id } } });

    console.log("\n" + "=".repeat(65));
    console.log("Phase 3 + Phase 4 complete!\n");
    console.log("  Season         : 2025/26 EHLA Group B");
    console.log("  Season ID      : " + season.id);
    console.log("  Season status  : " + season.status);
    console.log("  Clubs in season: " + clubs.length);
    console.log("  Players (approved): " + scpCount);
    console.log("  Coaches (approved): " + sccCount);
    console.log("  Referees (org) : " + refereeCount);
    console.log("  MEAs (org)     : " + meaCount);
    console.log("\n  Next: run Phase 5 with SEASON_ID=" + season.id);
    console.log("=".repeat(65));
}

main()
    .catch((e) => { console.error("\n  Failed:", e); process.exit(1); })
    .finally(() => prisma.$disconnect());
