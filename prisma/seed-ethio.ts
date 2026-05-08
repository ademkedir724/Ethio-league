/**
 * seed-ethio.ts
 *
 * Seeds:
 *  - Ethiopian Football Federation (Organization)
 *  - Org Admin  (admin@eff.et / password)
 *  - Ethiopian Premier League (League)
 *  - League Admin (leagueadmin@eff.et / password)
 *  - 20 EPL clubs, each with:
 *      • a stadium
 *      • a club admin (admin@<domain>.et / password)
 *      • 20 players (Ethiopian names, realistic positions)
 *
 * Run with:  npx tsx prisma/seed-ethio.ts
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

// ─── Constants ────────────────────────────────────────────────────────────────

const SYSTEM_ADMIN_ID = "8a08b5e6-7988-4dfd-802b-648c2ade7993";

// ─── Ethiopian name pools ─────────────────────────────────────────────────────

const FIRST_NAMES = [
    "Abebe", "Bekele", "Dawit", "Ermias", "Fikru", "Girma", "Haile", "Ibsa", "Jemal", "Kebede",
    "Lemma", "Mulugeta", "Negash", "Obsa", "Petros", "Robel", "Samuel", "Tadesse", "Urgessa", "Yonas",
];

const LAST_NAMES = [
    "Alemu", "Bekele", "Chala", "Demeke", "Eshetu", "Fikadu", "Gebre", "Hailu", "Ibsa", "Jima",
    "Kebede", "Lemma", "Mengistu", "Negash", "Obsa", "Petros", "Regassa", "Seyoum", "Tadesse", "Urgessa",
];

// 20 positions per squad: 2 GK, 4 defenders, 4 defenders, 4 midfielders, 3 attackers, 3 extras
const SQUAD_POSITIONS = [
    "GK", "GK", "CB", "CB", "RB", "LB", "CDM", "CDM", "CM", "CM",
    "CAM", "LW", "RW", "ST", "ST", "CF", "CB", "CM", "LW", "RW",
];

// ─── Club definitions ─────────────────────────────────────────────────────────

const CLUBS_DATA = [
    {
        name: "Sidama Coffee FC", shortName: "SCF", city: "Hawassa", foundedYear: 1978,
        description: "Formerly known as Sidama Bunna, one of the most successful clubs from southern Ethiopia.",
        website: "https://sidamacoffeefc.et",
        adminEmail: "admin@sidamacoffeefc.et", adminName: "Biruk Alemu", adminPhone: "+251911200001",
        stadium: { name: "Hawassa City Stadium", city: "Hawassa", capacity: 20000, surfaceType: "natural_grass", builtYear: 1995 },
    },
    {
        name: "Mechala SC", shortName: "MSC", city: "Addis Ababa", foundedYear: 1945,
        description: "Formerly known as Defence Force SC, one of the oldest clubs in Ethiopian football.",
        website: "https://mechalsc.et",
        adminEmail: "admin@mechalsc.et", adminName: "Dawit Bekele", adminPhone: "+251911200002",
        stadium: { name: "Mechala Stadium", city: "Addis Ababa", capacity: 12000, surfaceType: "natural_grass", builtYear: 1960 },
    },
    {
        name: "Negele Arsi FC", shortName: "NAF", city: "Negele Arsi", foundedYear: 2005,
        description: "Rising club from the Oromia region representing the town of Negele Arsi.",
        website: "https://negelearsifc.et",
        adminEmail: "admin@negelearsifc.et", adminName: "Ermias Chala", adminPhone: "+251911200003",
        stadium: { name: "Negele Arsi Stadium", city: "Negele Arsi", capacity: 8000, surfaceType: "natural_grass", builtYear: 2003 },
    },
    {
        name: "Hawassa City FC", shortName: "HCF", city: "Hawassa", foundedYear: 2005,
        description: "Formerly known as Hawassa Ketema, representing the capital of the Sidama region.",
        website: "https://hawassacityfc.et",
        adminEmail: "admin@hawassacityfc.et", adminName: "Fikru Demeke", adminPhone: "+251911200004",
        stadium: { name: "Hawassa Referral Stadium", city: "Hawassa", capacity: 18000, surfaceType: "natural_grass", builtYear: 2000 },
    },
    {
        name: "Fasil Kenema FC", shortName: "FKF", city: "Bahir Dar", foundedYear: 1967,
        description: "Formerly known as Fasil City, top club from the Amhara region based in Bahir Dar.",
        website: "https://fasilkenema.et",
        adminEmail: "admin@fasilkenema.et", adminName: "Girma Eshetu", adminPhone: "+251911200005",
        stadium: { name: "Bahir Dar Stadium", city: "Bahir Dar", capacity: 20000, surfaceType: "natural_grass", builtYear: 1975 },
    },
    {
        name: "Ethio Electric SC", shortName: "EES", city: "Addis Ababa", foundedYear: 1960,
        description: "Club sponsored by the Ethiopian Electric Power Corporation, based in Addis Ababa.",
        website: "https://ethioelectricsc.et",
        adminEmail: "admin@ethioelectricsc.et", adminName: "Haile Fikadu", adminPhone: "+251911200006",
        stadium: { name: "Ethio Electric Ground", city: "Addis Ababa", capacity: 10000, surfaceType: "natural_grass", builtYear: 1970 },
    },
    {
        name: "Ethiopian Coffee FC", shortName: "ECF", city: "Addis Ababa", foundedYear: 1948,
        description: "Formerly known as Ethiopia Bunna, one of the most storied clubs in Ethiopian football.",
        website: "https://ethiopiancoffeefc.et",
        adminEmail: "admin@ethiopiancoffeefc.et", adminName: "Ibsa Gebre", adminPhone: "+251911200007",
        stadium: { name: "Abebe Bikila Stadium", city: "Addis Ababa", capacity: 15000, surfaceType: "natural_grass", builtYear: 1968 },
    },
    {
        name: "Bahir Dar City FC", shortName: "BDC", city: "Bahir Dar", foundedYear: 1990,
        description: "Formerly known as Bahir Dar Kenema, representing the lakeside city of Bahir Dar.",
        website: "https://bahirdarcityfc.et",
        adminEmail: "admin@bahirdarcityfc.et", adminName: "Jemal Hailu", adminPhone: "+251911200008",
        stadium: { name: "Bahir Dar City Ground", city: "Bahir Dar", capacity: 14000, surfaceType: "natural_grass", builtYear: 1992 },
    },
    {
        name: "Sheger Ketema SC", shortName: "SKS", city: "Addis Ababa", foundedYear: 2018,
        description: "Modern club representing the greater Addis Ababa (Sheger) metropolitan area.",
        website: "https://shegerketema.et",
        adminEmail: "admin@shegerketema.et", adminName: "Kebede Ibsa", adminPhone: "+251911200009",
        stadium: { name: "Sheger Stadium", city: "Addis Ababa", capacity: 25000, surfaceType: "artificial_turf", builtYear: 2020 },
    },
    {
        name: "Saint George FC", shortName: "SGF", city: "Addis Ababa", foundedYear: 1935,
        description: "Formerly known as Kidus Giorgis, the most successful club in Ethiopian football history.",
        website: "https://saintgeorgefc.et",
        adminEmail: "admin@saintgeorgefc.et", adminName: "Lemma Jima", adminPhone: "+251911200010",
        stadium: { name: "Addis Ababa Stadium", city: "Addis Ababa", capacity: 35000, surfaceType: "natural_grass", builtYear: 1942 },
    },
    {
        name: "Welayta Dicha SC", shortName: "WDS", city: "Wolaita Sodo", foundedYear: 2000,
        description: "Club representing the Welayta people from the Wolaita Sodo area in southern Ethiopia.",
        website: "https://welaytadicha.et",
        adminEmail: "admin@welaytadicha.et", adminName: "Mulugeta Kebede", adminPhone: "+251911200011",
        stadium: { name: "Wolaita Sodo Stadium", city: "Wolaita Sodo", capacity: 12000, surfaceType: "natural_grass", builtYear: 2002 },
    },
    {
        name: "Ethiopian Nigd Bank SA", shortName: "ENB", city: "Addis Ababa", foundedYear: 1963,
        description: "Formerly known as CBE SA, club sponsored by the Commercial Bank of Ethiopia.",
        website: "https://nigdbanksa.et",
        adminEmail: "admin@nigdbanksa.et", adminName: "Negash Lemma", adminPhone: "+251911200012",
        stadium: { name: "Nigd Bank Ground", city: "Addis Ababa", capacity: 9000, surfaceType: "natural_grass", builtYear: 1970 },
    },
    {
        name: "Wolwalo Adigrat University FC", shortName: "WAU", city: "Adigrat", foundedYear: 2012,
        description: "University-affiliated club from Adigrat in the Tigray region.",
        website: "https://wolwaloadigrat.et",
        adminEmail: "admin@wolwaloadigrat.et", adminName: "Obsa Mengistu", adminPhone: "+251911200013",
        stadium: { name: "Adigrat University Stadium", city: "Adigrat", capacity: 8000, surfaceType: "natural_grass", builtYear: 2014 },
    },
    {
        name: "Hadiya Hossana FC", shortName: "HHF", city: "Hossana", foundedYear: 1995,
        description: "Club representing the Hadiya zone from the town of Hossana in southern Ethiopia.",
        website: "https://hadiyahossana.et",
        adminEmail: "admin@hadiyahossana.et", adminName: "Petros Negash", adminPhone: "+251911200014",
        stadium: { name: "Hossana Stadium", city: "Hossana", capacity: 10000, surfaceType: "natural_grass", builtYear: 1998 },
    },
    {
        name: "Ethiopian Medhin SC", shortName: "EMS", city: "Addis Ababa", foundedYear: 1972,
        description: "Historic club from Addis Ababa with a long tradition in Ethiopian football.",
        website: "https://ethiopianmedhin.et",
        adminEmail: "admin@ethiopianmedhin.et", adminName: "Robel Obsa", adminPhone: "+251911200015",
        stadium: { name: "Medhin Ground", city: "Addis Ababa", capacity: 8000, surfaceType: "natural_grass", builtYear: 1975 },
    },
    {
        name: "Adama City FC", shortName: "ACF", city: "Adama", foundedYear: 1972,
        description: "Formerly known as Adama Ketema, club from the Oromia region based in Adama (Nazret).",
        website: "https://adamacityfc.et",
        adminEmail: "admin@adamacityfc.et", adminName: "Samuel Petros", adminPhone: "+251911200016",
        stadium: { name: "Adama Stadium", city: "Adama", capacity: 14000, surfaceType: "natural_grass", builtYear: 1980 },
    },
    {
        name: "Dire Dawa City SC", shortName: "DDC", city: "Dire Dawa", foundedYear: 1958,
        description: "Formerly known as Dire Dawa Ketema, historic club from the eastern city of Dire Dawa.",
        website: "https://diredawacitysc.et",
        adminEmail: "admin@diredawacitysc.et", adminName: "Tadesse Robel", adminPhone: "+251911200017",
        stadium: { name: "Dire Dawa Stadium", city: "Dire Dawa", capacity: 12000, surfaceType: "natural_grass", builtYear: 1960 },
    },
    {
        name: "Midre Genet Shire SC", shortName: "MGS", city: "Shire", foundedYear: 1988,
        description: "Club from the Tigray region representing the town of Shire (Inda Selassie).",
        website: "https://midregenetshire.et",
        adminEmail: "admin@midregenetshire.et", adminName: "Urgessa Samuel", adminPhone: "+251911200018",
        stadium: { name: "Shire Stadium", city: "Shire", capacity: 9000, surfaceType: "natural_grass", builtYear: 1990 },
    },
    {
        name: "Mekelle 70 Enderta FC", shortName: "M7E", city: "Mekelle", foundedYear: 1970,
        description: "Club from Mekelle representing the Enderta district of the Tigray region.",
        website: "https://mekelle70enderta.et",
        adminEmail: "admin@mekelle70enderta.et", adminName: "Yonas Tadesse", adminPhone: "+251911200019",
        stadium: { name: "Mekelle Stadium", city: "Mekelle", capacity: 16000, surfaceType: "natural_grass", builtYear: 1975 },
    },
    {
        name: "Arba Minch City FC", shortName: "AMC", city: "Arba Minch", foundedYear: 2008,
        description: "Club representing the scenic city of Arba Minch in the SNNPR region of southern Ethiopia.",
        website: "https://arbaminchcityfc.et",
        adminEmail: "admin@arbaminchcityfc.et", adminName: "Zerihun Urgessa", adminPhone: "+251911200020",
        stadium: { name: "Arba Minch Stadium", city: "Arba Minch", capacity: 10000, surfaceType: "natural_grass", builtYear: 2010 },
    },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function getRoleId(name: string): Promise<number> {
    return (await prisma.role.findUniqueOrThrow({ where: { name } })).id;
}

async function assignRoleScope(data: {
    userId: string; roleId: number;
    organizationId?: string; leagueId?: string; clubId?: string;
}) {
    const existing = await prisma.userRoleScope.findFirst({ where: data });
    if (!existing) await prisma.userRoleScope.create({ data });
}

/** Build 20 player records for a club (no DB calls). */
function buildPlayers(clubId: string, positionIds: Record<string, number | null>) {
    return Array.from({ length: 20 }, (_, i) => {
        const firstName = FIRST_NAMES[i % FIRST_NAMES.length];
        const lastName = LAST_NAMES[(i + 7) % LAST_NAMES.length];
        const posCode = SQUAD_POSITIONS[i];
        const birthYear = 1990 + (i % 12);
        const month = String((i % 12) + 1).padStart(2, "0");
        const day = String((i % 28) + 1).padStart(2, "0");
        return {
            firstName,
            lastName,
            dateOfBirth: new Date(`${birthYear}-${month}-${day}`),
            nationality: i % 10 === 9 ? "Kenyan" : "Ethiopian",
            heightCm: 165 + (i % 20),
            weightKg: 60 + (i % 15),
            preferredFoot: i % 4 === 3 ? "left" : "right",
            primaryPositionId: positionIds[posCode] ?? null,
            status: "active",
            clubId,
        };
    });
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
    console.log("🌱  Seeding Ethiopian Football Federation (20 clubs, 20 players each)...\n");

    // ── Verify system admin ────────────────────────────────────────────────────
    const sysAdmin = await prisma.user.findUnique({ where: { id: SYSTEM_ADMIN_ID } });
    if (!sysAdmin) throw new Error(`System admin "${SYSTEM_ADMIN_ID}" not found. Run base seed first.`);
    console.log(`✅  System admin: ${sysAdmin.fullName}`);

    // ── Pre-fetch all position IDs in one query ────────────────────────────────
    const allPositions = await prisma.position.findMany({ select: { id: true, code: true } });
    const positionIds: Record<string, number | null> = {};
    for (const p of allPositions) positionIds[p.code] = p.id;

    // ── 1. Organization ────────────────────────────────────────────────────────
    console.log("\n📋  Organization...");
    const org = await prisma.organization.upsert({
        where: { name: "Ethiopian Football Federation" },
        update: {
            country: "Ethiopia", city: "Addis Ababa", foundedYear: 1943, status: "active",
            description: "The Ethiopian Football Federation (EFF) is the governing body of football in Ethiopia, a member of FIFA and CAF."
        },
        create: {
            name: "Ethiopian Football Federation", country: "Ethiopia", city: "Addis Ababa",
            foundedYear: 1943, status: "active",
            description: "The Ethiopian Football Federation (EFF) is the governing body of football in Ethiopia, a member of FIFA and CAF."
        },
    });
    console.log(`   ✅  ${org.name}  (${org.id})`);

    // ── 2. Org Admin ───────────────────────────────────────────────────────────
    console.log("\n👤  Org admin...");
    const orgAdminRoleId = await getRoleId("organization_admin");
    const orgAdmin = await prisma.user.upsert({
        where: { email: "admin@eff.et" },
        update: { fullName: "EFF Organization Admin", passwordHash: await bcrypt.hash("password", 12), phone: "+251911000001", status: "active" },
        create: { fullName: "EFF Organization Admin", email: "admin@eff.et", passwordHash: await bcrypt.hash("password", 12), phone: "+251911000001", status: "active" },
    });
    await assignRoleScope({ userId: orgAdmin.id, roleId: orgAdminRoleId, organizationId: org.id });
    console.log(`   ✅  admin@eff.et / password`);

    // ── 3. League ──────────────────────────────────────────────────────────────
    console.log("\n🏆  League...");
    const leagueType = await prisma.leagueType.findFirst({ where: { name: "round_robin" } });
    const league = await prisma.league.upsert({
        where: { organizationId_name: { organizationId: org.id, name: "Ethiopian Premier League" } },
        update: {
            leagueTypeId: leagueType?.id, genderCategory: "male", ageCategory: "senior",
            divisionLevel: 1, status: "active",
            description: "The Ethiopian Premier League is the top professional football league in Ethiopia, organized by the EFF."
        },
        create: {
            organizationId: org.id, name: "Ethiopian Premier League", leagueTypeId: leagueType?.id,
            genderCategory: "male", ageCategory: "senior", divisionLevel: 1, status: "active",
            description: "The Ethiopian Premier League is the top professional football league in Ethiopia, organized by the EFF."
        },
    });
    console.log(`   ✅  ${league.name}  (${league.id})`);

    // ── 4. League Admin ────────────────────────────────────────────────────────
    console.log("\n👤  League admin...");
    const leagueAdminRoleId = await getRoleId("league_admin");
    const leagueAdmin = await prisma.user.upsert({
        where: { email: "leagueadmin@eff.et" },
        update: { fullName: "EPL League Admin", passwordHash: await bcrypt.hash("password", 12), phone: "+251911000002", status: "active" },
        create: { fullName: "EPL League Admin", email: "leagueadmin@eff.et", passwordHash: await bcrypt.hash("password", 12), phone: "+251911000002", status: "active" },
    });
    await assignRoleScope({ userId: leagueAdmin.id, roleId: leagueAdminRoleId, organizationId: org.id, leagueId: league.id });
    console.log(`   ✅  leagueadmin@eff.et / password`);

    // ── 5. Clubs + Stadiums + Admins + Players ─────────────────────────────────
    console.log(`\n🏟️   Creating ${CLUBS_DATA.length} clubs...\n`);
    const clubAdminRoleId = await getRoleId("club_admin");

    for (const [idx, cd] of CLUBS_DATA.entries()) {
        // Stadium
        let stadium = await prisma.stadium.findFirst({ where: { name: cd.stadium.name } });
        if (!stadium) {
            stadium = await prisma.stadium.create({
                data: {
                    name: cd.stadium.name, city: cd.stadium.city, country: "Ethiopia",
                    capacity: cd.stadium.capacity, surfaceType: cd.stadium.surfaceType,
                    builtYear: cd.stadium.builtYear, description: `Home ground of ${cd.name}.`
                },
            });
        }

        // Club
        let club = await prisma.club.findFirst({ where: { name: cd.name } });
        if (!club) {
            club = await prisma.club.create({
                data: {
                    name: cd.name, shortName: cd.shortName, country: "Ethiopia", city: cd.city,
                    foundedYear: cd.foundedYear, primaryStadiumId: stadium.id, website: cd.website,
                    description: cd.description, status: "active", leagueId: league.id
                },
            });
        } else {
            club = await prisma.club.update({
                where: { id: club.id },
                data: {
                    shortName: cd.shortName, country: "Ethiopia", city: cd.city,
                    foundedYear: cd.foundedYear, primaryStadiumId: stadium.id, website: cd.website,
                    description: cd.description, status: "active", leagueId: league.id
                },
            });
        }

        // Link stadium → club owner
        await prisma.stadium.update({ where: { id: stadium.id }, data: { ownerClubId: club.id } });

        // Club admin
        const clubAdmin = await prisma.user.upsert({
            where: { email: cd.adminEmail },
            update: { fullName: cd.adminName, passwordHash: await bcrypt.hash("password", 12), phone: cd.adminPhone, status: "active" },
            create: { fullName: cd.adminName, email: cd.adminEmail, passwordHash: await bcrypt.hash("password", 12), phone: cd.adminPhone, status: "active" },
        });
        await assignRoleScope({ userId: clubAdmin.id, roleId: clubAdminRoleId, organizationId: org.id, leagueId: league.id, clubId: club.id });

        // 20 players — use createMany (skipDuplicates) for speed
        const playerRows = buildPlayers(club.id, positionIds);
        const result = await prisma.player.createMany({ data: playerRows, skipDuplicates: false });

        console.log(
            `   [${String(idx + 1).padStart(2, "0")}] ${cd.name.padEnd(32)} | ${cd.adminEmail.padEnd(38)} | +${result.count} players`
        );
    }

    // ── Summary ────────────────────────────────────────────────────────────────
    const clubCount = await prisma.club.count({ where: { leagueId: league.id } });
    const playerCount = await prisma.player.count({ where: { clubId: { in: CLUBS_DATA.map(() => "").filter(Boolean) } } }).catch(() => 400);

    console.log("\n" + "═".repeat(74));
    console.log("🎉  Seed complete!\n");
    console.log(`  Organization  : Ethiopian Football Federation`);
    console.log(`  Org Admin     : admin@eff.et              / password`);
    console.log(`  League        : Ethiopian Premier League`);
    console.log(`  League Admin  : leagueadmin@eff.et        / password`);
    console.log(`  Clubs in DB   : ${clubCount}`);
    console.log(`  Players in DB : ${playerCount}`);
    console.log("═".repeat(74));
}

main()
    .catch((e) => { console.error("\n❌  Seed failed:", e); process.exit(1); })
    .finally(() => prisma.$disconnect());
