/**
 * cleanup-ethio.ts
 * Deletes everything created by seed-ethio:
 *   players, club_images, user_role_scopes for club/league/org admins,
 *   clubs, stadiums, leagues, organizations (EFF only), and their admin users.
 *
 * Run with:  npx tsx prisma/cleanup-ethio.ts
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

async function main() {
    console.log("🧹  Cleaning up seed data...\n");

    // ── Find the EFF org ───────────────────────────────────────────────────────
    const org = await prisma.organization.findUnique({
        where: { name: "Ethiopian Football Federation" },
    });
    if (!org) {
        console.log("   ℹ️  Ethiopian Football Federation not found — nothing to clean.");
        return;
    }
    console.log(`   Found org: ${org.name} (${org.id})`);

    // ── Find all leagues under EFF ─────────────────────────────────────────────
    const leagues = await prisma.league.findMany({ where: { organizationId: org.id } });
    const leagueIds = leagues.map((l) => l.id);
    console.log(`   Found ${leagues.length} league(s)`);

    // ── Find all clubs in those leagues ───────────────────────────────────────
    const clubs = await prisma.club.findMany({
        where: leagueIds.length > 0 ? { leagueId: { in: leagueIds } } : { id: "none" },
    });
    const clubIds = clubs.map((c) => c.id);
    console.log(`   Found ${clubs.length} club(s)`);

    // ── Delete players belonging to these clubs ────────────────────────────────
    const delPlayers = await prisma.player.deleteMany({
        where: { clubId: { in: clubIds } },
    });
    console.log(`   Deleted ${delPlayers.count} players`);

    // ── Delete club images ─────────────────────────────────────────────────────
    const delClubImages = await prisma.clubImage.deleteMany({
        where: { clubId: { in: clubIds } },
    });
    console.log(`   Deleted ${delClubImages.count} club images`);

    // ── Delete user_role_scopes tied to these clubs / leagues / org ───────────
    const delScopes = await prisma.userRoleScope.deleteMany({
        where: {
            OR: [
                { organizationId: org.id },
                { leagueId: { in: leagueIds } },
                { clubId: { in: clubIds } },
            ],
        },
    });
    console.log(`   Deleted ${delScopes.count} user role scopes`);

    // ── Collect admin user emails to delete ───────────────────────────────────
    const adminEmails = [
        "admin@eff.et",
        "leagueadmin@eff.et",
        // club admins
        "admin@sidamacoffeefc.et",
        "admin@mechalsc.et",
        "admin@negelearsifc.et",
        "admin@hawassacityfc.et",
        "admin@fasilkenema.et",
        "admin@ethioelectricsc.et",
        "admin@ethiopiancoffeefc.et",
        "admin@bahirdarcityfc.et",
        "admin@shegerketema.et",
        "admin@saintgeorgefc.et",
        "admin@welaytadicha.et",
        "admin@nigdbanksa.et",
        "admin@wolwaloadigrat.et",
        "admin@hadiyahossana.et",
        "admin@ethiopianmedhin.et",
        "admin@adamacityfc.et",
        "admin@diredawacitysc.et",
        "admin@midregenetshire.et",
        "admin@mekelle70enderta.et",
        "admin@arbaminchcityfc.et",
        // old 10-club admins from first seed run
        "admin@saintgeorgefc.et",
        "admin@ethiopiancoffeefc.et",
        "admin@fasilkenema.et",
        "admin@wolkiteketema.et",
        "admin@hawassaketema.et",
        "admin@diredawaketema.et",
        "admin@adamaketema.et",
        "admin@mekellekenema.et",
        "admin@jimmaabajifar.et",
        "admin@dedebitfc.et",
    ];

    const delUsers = await prisma.user.deleteMany({
        where: { email: { in: [...new Set(adminEmails)] } },
    });
    console.log(`   Deleted ${delUsers.count} admin users`);

    // ── Delete clubs ───────────────────────────────────────────────────────────
    const delClubs = await prisma.club.deleteMany({
        where: { id: { in: clubIds } },
    });
    console.log(`   Deleted ${delClubs.count} clubs`);

    // ── Delete stadiums owned by those clubs (ownerClubId now null after club delete) ──
    // Also delete any orphan stadiums by name
    const stadiumNames = [
        "Hawassa City Stadium", "Mechala Stadium", "Negele Arsi Stadium", "Hawassa Referral Stadium",
        "Bahir Dar Stadium", "Ethio Electric Ground", "Abebe Bikila Stadium", "Bahir Dar City Ground",
        "Sheger Stadium", "Addis Ababa Stadium", "Wolaita Sodo Stadium", "Nigd Bank Ground",
        "Adigrat University Stadium", "Hossana Stadium", "Medhin Ground", "Adama Stadium",
        "Dire Dawa Stadium", "Shire Stadium", "Mekelle Stadium", "Arba Minch Stadium",
        // old stadiums from first run
        "Wolkite Stadium", "Hawassa Stadium", "Dedebit Training Ground", "Jimma Stadium",
    ];
    const delStadiums = await prisma.stadium.deleteMany({
        where: { name: { in: stadiumNames } },
    });
    console.log(`   Deleted ${delStadiums.count} stadiums`);

    // ── Delete leagues ─────────────────────────────────────────────────────────
    const delLeagues = await prisma.league.deleteMany({
        where: { organizationId: org.id },
    });
    console.log(`   Deleted ${delLeagues.count} leagues`);

    // ── Delete organization ────────────────────────────────────────────────────
    await prisma.organization.delete({ where: { id: org.id } });
    console.log(`   Deleted organization: Ethiopian Football Federation`);

    console.log("\n✅  Cleanup complete.");
}

main()
    .catch((e) => { console.error("❌  Cleanup failed:", e); process.exit(1); })
    .finally(() => prisma.$disconnect());
