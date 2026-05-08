/**
 * seed-season.ts
 *
 * Extends the existing EFF seed for a specific season:
 *
 *  1. For every club in the EPL season:
 *     - Register the club in the season (SeasonClub) if not already
 *     - Register all 20 club players as SeasonClubPlayer (requestStatus=approved, status=active)
 *     - Create 1 head coach per club and register as SeasonClubCoach (requestStatus=approved, status=active)
 *
 *  2. Create 44 referees (Ethiopian names, realistic license levels)
 *
 *  3. Create 11 match event admin users (mea01@eff.et … mea11@eff.et / password)
 *     and assign them the match_event_admin role scoped to the EFF org
 *
 * Run with:  npx tsx prisma/seed-season.ts
 * Pass season ID as env var or edit SEASON_ID below.
 */

import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import bcrypt from "bcryptjs";

const pool = new Pool({
    connectionString: process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL!,
    connectionTimeoutMillis: 30_000,
    idleTimeoutMillis: 30_000,
    max: 1,
});
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

// ── Edit this if you want to target a different season ────────────────────────
const SEASON_ID = process.env.SEASON_ID ?? "bd1afd5c-b173-49bd-b8bd-97bc6f60c77e";

// ─── Name pools ───────────────────────────────────────────────────────────────

const FIRST_NAMES = [
    "Abebe", "Bekele", "Dawit", "Ermias", "Fikru", "Girma", "Haile", "Ibsa", "Jemal", "Kebede",
    "Lemma", "Mulugeta", "Negash", "Obsa", "Petros", "Robel", "Samuel", "Tadesse", "Urgessa", "Yonas",
    "Zerihun", "Amanuel", "Biruk", "Chala", "Dereje", "Eyob", "Fasil", "Getachew", "Henok", "Ismail",
    "Kedir", "Luel", "Mesfin", "Netsanet", "Oliyad", "Paulos", "Rediet", "Sintayehu", "Tesfaye", "Wondwosen",
    "Abiy", "Berhane", "Dagim", "Elias", "Fiker", "Getu", "Hiwot", "Iyasu", "Kaleb", "Liya",
];

const LAST_NAMES = [
    "Alemu", "Bekele", "Chala", "Demeke", "Eshetu", "Fikadu", "Gebre", "Hailu", "Ibsa", "Jima",
    "Kebede", "Lemma", "Mengistu", "Negash", "Obsa", "Petros", "Regassa", "Seyoum", "Tadesse", "Urgessa",
    "Wolde", "Yilma", "Zeleke", "Abate", "Birru", "Desta", "Eshete", "Fikre", "Girma", "Habtamu",
    "Imiru", "Jote", "Kassa", "Lema", "Mamo", "Negera", "Olana", "Paulos", "Roba", "Sorsa",
    "Tefera", "Wako", "Yimer", "Zewdu", "Abera", "Benti", "Daba", "Edosa", "Feyisa", "Gonfa",
];

const LICENSE_LEVELS = ["FIFA", "CAF", "National A", "National B", "National C", "Regional"];
const COACH_ROLES = ["head_coach", "assistant_coach", "goalkeeper_coach", "fitness_coach"];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function name(i: number, offset = 0) {
    return {
        firstName: FIRST_NAMES[(i + offset) % FIRST_NAMES.length],
        lastName: LAST_NAMES[(i + offset * 3) % LAST_NAMES.length],
    };
}

async function getRoleId(roleName: string): Promise<number> {
    return (await prisma.role.findUniqueOrThrow({ where: { name: roleName } })).id;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
    console.log(`\n🌱  seed-season.ts  →  season ${SEASON_ID}\n`);

    // ── Verify season ──────────────────────────────────────────────────────────
    const season = await prisma.season.findUnique({
        where: { id: SEASON_ID },
        include: { league: { include: { organization: true } } },
    });
    if (!season) throw new Error(`Season ${SEASON_ID} not found`);
    console.log(`✅  Season: "${season.name}"  (${season.status})`);
    console.log(`   League : ${season.league.name}`);
    console.log(`   Org    : ${season.league.organization.name}  (${season.league.organizationId})\n`);

    const orgId = season.league.organizationId;
    const leagueId = season.leagueId;

    // ── Fetch all clubs in this league ────────────────────────────────────────
    const leagueClubs = await prisma.club.findMany({
        where: { leagueId },
        include: { players: true },
    });
    console.log(`   Found ${leagueClubs.length} clubs in league\n`);

    // ── 1. Register clubs + players + coaches in season ───────────────────────
    console.log("🏟️   Registering clubs, players and coaches in season...\n");

    let totalPlayers = 0;
    let totalCoaches = 0;

    for (const [ci, club] of leagueClubs.entries()) {
        // 1a. SeasonClub
        let seasonClub = await prisma.seasonClub.findUnique({
            where: { seasonId_clubId: { seasonId: SEASON_ID, clubId: club.id } },
        });
        if (!seasonClub) {
            seasonClub = await prisma.seasonClub.create({
                data: { seasonId: SEASON_ID, clubId: club.id, status: "active" },
            });
        } else if (seasonClub.status !== "active") {
            seasonClub = await prisma.seasonClub.update({
                where: { id: seasonClub.id },
                data: { status: "active" },
            });
        }

        // 1b. SeasonClubPlayer — all 20 players, approved + active
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

        // 1c. Coach — create one head coach per club if none exists
        const existingCoach = await prisma.seasonClubCoach.findFirst({
            where: { seasonClubId: seasonClub.id },
        });

        let addedCoach = 0;
        if (!existingCoach) {
            const { firstName, lastName } = name(ci, 5);
            const coach = await prisma.coach.create({
                data: {
                    firstName,
                    lastName,
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
            `   [${String(ci + 1).padStart(2, "0")}] ${club.name.padEnd(32)} | +${addedPlayers} players | +${addedCoach} coach`
        );
    }

    console.log(`\n   ✅  Total players registered : ${totalPlayers}`);
    console.log(`   ✅  Total coaches registered : ${totalCoaches}`);

    // ── 2. Create 44 referees ─────────────────────────────────────────────────
    console.log("\n🟨  Creating 44 referees...");
    let newReferees = 0;
    for (let i = 0; i < 44; i++) {
        const { firstName, lastName } = name(i, 11);
        const email = `referee${String(i + 1).padStart(2, "0")}@eff.et`;
        const existing = await prisma.referee.findFirst({ where: { firstName, lastName } });
        if (!existing) {
            await prisma.referee.create({
                data: {
                    firstName,
                    lastName,
                    dateOfBirth: new Date(`${1975 + (i % 20)}-${String((i % 12) + 1).padStart(2, "0")}-${String((i % 28) + 1).padStart(2, "0")}`),
                    nationality: i % 8 === 0 ? "Kenyan" : "Ethiopian",
                    licenseLevel: LICENSE_LEVELS[i % LICENSE_LEVELS.length],
                    experienceYears: 2 + (i % 18),
                    status: "active",
                },
            });
            newReferees++;
        }
    }
    console.log(`   ✅  ${newReferees} new referees created`);

    // ── 3. Create 11 match event admins ───────────────────────────────────────
    console.log("\n👤  Creating 11 match event admins...");
    const meaRoleId = await getRoleId("match_event_admin");
    const pwHash = await bcrypt.hash("password", 12);
    let newMEAs = 0;

    for (let i = 1; i <= 11; i++) {
        const email = `mea${String(i).padStart(2, "0")}@eff.et`;
        const { firstName, lastName } = name(i - 1, 20);
        const fullName = `${firstName} ${lastName}`;

        const user = await prisma.user.upsert({
            where: { email },
            update: { fullName, passwordHash: pwHash, status: "active" },
            create: { fullName, email, passwordHash: pwHash, phone: `+25191130${String(i).padStart(4, "0")}`, status: "active" },
        });

        // Org-scoped MEA role (no seasonId — season assignment happens via the assignments API)
        const existingScope = await prisma.userRoleScope.findFirst({
            where: { userId: user.id, roleId: meaRoleId, organizationId: orgId, seasonId: null },
        });
        if (!existingScope) {
            await prisma.userRoleScope.create({
                data: { userId: user.id, roleId: meaRoleId, organizationId: orgId },
            });
            newMEAs++;
        }

        console.log(`   [${String(i).padStart(2, "0")}] ${email.padEnd(22)} | ${fullName}`);
    }
    console.log(`   ✅  ${newMEAs} new MEA users created`);

    // ── Summary ────────────────────────────────────────────────────────────────
    const scpCount = await prisma.seasonClubPlayer.count({ where: { seasonClub: { seasonId: SEASON_ID } } });
    const sccCount = await prisma.seasonClubCoach.count({ where: { seasonClub: { seasonId: SEASON_ID } } });
    const refCount = await prisma.referee.count();
    const meaCount = await prisma.userRoleScope.count({ where: { roleId: meaRoleId, organizationId: orgId } });

    console.log("\n" + "═".repeat(60));
    console.log("🎉  Done!\n");
    console.log(`  Season players (approved) : ${scpCount}`);
    console.log(`  Season coaches (approved) : ${sccCount}`);
    console.log(`  Total referees in system  : ${refCount}`);
    console.log(`  MEA users for org         : ${meaCount}`);
    console.log(`  MEA login pattern         : mea01@eff.et … mea11@eff.et / password`);
    console.log("═".repeat(60));
}

main()
    .catch((e) => { console.error("\n❌  Failed:", e); process.exit(1); })
    .finally(() => prisma.$disconnect());
