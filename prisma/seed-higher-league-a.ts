/**
 * seed-higher-league-a.ts  —  Phase 1 + Phase 2
 *
 * Phase 1: League "Ethiopian Higher League Group A" + League Admin
 * Phase 2: 10 clubs + stadiums + club admins + 20 players each
 *
 * Run with:  npx tsx prisma/seed-higher-league-a.ts
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

// ─── EFF org name (must already exist) ───────────────────────────────────────
const EFF_ORG_NAME = "Ethiopian Football Federation";

// ─── Ethiopian name pools (120 each) ─────────────────────────────────────────
const CHRISTIAN_FIRST = [
    "Abebe", "Aklilu", "Alemu", "Amanuel", "Andargachew", "Ashenafi", "Asnake", "Assefa",
    "Ayalew", "Ayele", "Berhane", "Berihun", "Biruk", "Dawit", "Dereje", "Ermias",
    "Eyob", "Fasil", "Fikadu", "Fikre", "Gebremichael", "Getachew", "Girma", "Habtamu",
    "Haile", "Henok", "Kibrom", "Kiros", "Luel", "Mehari", "Mekonnen", "Meles",
    "Mesfin", "Mulugeta", "Natnael", "Negash", "Netsanet", "Paulos", "Petros", "Rediet",
    "Robel", "Samuel", "Selemon", "Sintayehu", "Solomon", "Tadesse", "Tekeste", "Tesfaye",
    "Tewodros", "Tsegay", "Wondwosen", "Worku", "Yared", "Yohannes", "Yonas", "Zerihun",
    "Zewdu", "Abiy", "Berhanu", "Dagim",
];
const MUSLIM_FIRST = [
    "Abdurahman", "Abubeker", "Ahmed", "Ali", "Aman", "Amir", "Anwar", "Arif",
    "Awol", "Ayub", "Aziz", "Bilal", "Chala", "Daud", "Derara", "Edris",
    "Elias", "Faisal", "Faruq", "Gemechu", "Hamid", "Hasan", "Hussein", "Ibrahim",
    "Idris", "Ismail", "Jamal", "Jemal", "Kadir", "Kalid", "Kedir", "Khalid",
    "Lema", "Mahdi", "Mamuye", "Mohammed", "Mubarek", "Mukhtar", "Mustafa", "Nasser",
    "Nuri", "Obsa", "Omar", "Osman", "Ramadan", "Rashid", "Redi", "Sadik",
    "Seid", "Shafi", "Siraj", "Suleiman", "Tariku", "Usman", "Wako", "Yusuf",
    "Zaid", "Zekarias", "Zeynu", "Zubair",
];
const CHRISTIAN_LAST = [
    "Abate", "Abebe", "Abera", "Abreha", "Adane", "Addis", "Admasu", "Afewerk",
    "Alemu", "Araya", "Asefa", "Assefa", "Ayalew", "Ayele", "Bekele", "Berhane",
    "Birru", "Chekol", "Dagnew", "Demeke", "Desta", "Eshete", "Eshetu", "Fikadu",
    "Gebre", "Gebrehiwot", "Gebremedhin", "Gebretsadik", "Girma", "Habtezion", "Haile", "Hailu",
    "Kebede", "Kefale", "Kiros", "Lemma", "Mamo", "Mehari", "Mengistu", "Mersha",
    "Mulat", "Mulugeta", "Negash", "Negera", "Nigatu", "Petros", "Regassa", "Seyoum",
    "Tadesse", "Tefera", "Tekle", "Tilahun", "Tsegaye", "Woldemariam", "Woldemichael", "Worku",
    "Yilma", "Yimer", "Zeleke", "Zewdu",
];
const MUSLIM_LAST = [
    "Abdo", "Abdulahi", "Abdulkadir", "Abdullahi", "Abubeker", "Ahmed", "Ahmedin", "Ali",
    "Aliyi", "Aman", "Amanu", "Anwar", "Arif", "Awol", "Ayub", "Aziz",
    "Beshir", "Chali", "Daud", "Dida", "Edris", "Elias", "Faisal", "Gemechu",
    "Hamid", "Hasan", "Hussen", "Ibrahim", "Idris", "Ismail", "Jamal", "Jemal",
    "Kadir", "Kalid", "Kedir", "Khalid", "Lema", "Mahdi", "Mohammed", "Mubarek",
    "Mukhtar", "Mustafa", "Nasser", "Nuri", "Obsa", "Omar", "Osman", "Rashid",
    "Redi", "Sadik", "Seid", "Shafi", "Siraj", "Suleiman", "Usman", "Wako",
    "Yusuf", "Zaid", "Zeynu", "Zubair",
];

const ALL_FIRST = [...CHRISTIAN_FIRST, ...MUSLIM_FIRST];
const ALL_LAST = [...CHRISTIAN_LAST, ...MUSLIM_LAST];

// ─── Seeded shuffle ───────────────────────────────────────────────────────────
function seededShuffle<T>(arr: T[], seed: number): T[] {
    const a = [...arr];
    let s = seed >>> 0;
    const rand = () => { s ^= s << 13; s ^= s >> 17; s ^= s << 5; return (s >>> 0) / 4294967296; };
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(rand() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

// Build a queue of unique name pairs starting from offset (to avoid collisions
// with the 464 names already used by the EPL seed)
function buildNameQueue(startOffset: number): Array<{ firstName: string; lastName: string }> {
    const firsts = seededShuffle(ALL_FIRST, 0xdeadbeef);
    const lasts = seededShuffle(ALL_LAST, 0xcafebabe);
    const pairs: Array<{ firstName: string; lastName: string }> = [];
    const used = new Set<string>();
    for (let li = 0; li < lasts.length; li++) {
        for (let fi = 0; fi < firsts.length; fi++) {
            const key = `${firsts[fi]}|${lasts[li]}`;
            if (!used.has(key)) {
                used.add(key);
                pairs.push({ firstName: firsts[fi], lastName: lasts[li] });
            }
        }
    }
    return pairs.slice(startOffset);
}

// ─── Squad positions (20 per club) ───────────────────────────────────────────
const SQUAD_POSITIONS = [
    "GK", "GK", "CB", "CB", "RB", "LB", "CDM", "CDM", "CM", "CM",
    "CAM", "LW", "RW", "ST", "ST", "CF", "CB", "CM", "LW", "RW",
];

// ─── Club definitions ─────────────────────────────────────────────────────────
const CLUBS = [
    {
        name: "Gamo Chencha FC",
        shortName: "GCF",
        city: "Chencha",
        foundedYear: 2005,
        description: "Club representing the Gamo highlands from the town of Chencha in southern Ethiopia.",
        website: "https://gamochencha.et",
        adminEmail: "admin@gamochencha.et",
        adminName: "Biruk Alemu",
        adminPhone: "+251912300001",
        stadium: { name: "Chencha Stadium", city: "Chencha", capacity: 6000, surfaceType: "natural_grass", builtYear: 2008 },
    },
    {
        name: "Yeka Kifle Ketema FC",
        shortName: "YKK",
        city: "Addis Ababa",
        foundedYear: 2010,
        description: "Club from the Yeka sub-city of Addis Ababa.",
        website: "https://yekakifleketema.et",
        adminEmail: "admin@yekakifleketema.et",
        adminName: "Dawit Bekele",
        adminPhone: "+251912300002",
        stadium: { name: "Yeka Stadium", city: "Addis Ababa", capacity: 8000, surfaceType: "natural_grass", builtYear: 2012 },
    },
    {
        name: "Batu Ketema FC",
        shortName: "BKF",
        city: "Ziway",
        foundedYear: 1998,
        description: "Club from Batu (Ziway) in the Oromia region, known for its lakeside location.",
        website: "https://batuketema.et",
        adminEmail: "admin@batuketema.et",
        adminName: "Ermias Chala",
        adminPhone: "+251912300003",
        stadium: { name: "Batu Stadium", city: "Ziway", capacity: 7000, surfaceType: "natural_grass", builtYear: 2000 },
    },
    {
        name: "Nib FC",
        shortName: "NIB",
        city: "Addis Ababa",
        foundedYear: 2003,
        description: "Club sponsored by Nib International Bank, based in Addis Ababa.",
        website: "https://nibfc.et",
        adminEmail: "admin@nibfc.et",
        adminName: "Fikru Demeke",
        adminPhone: "+251912300004",
        stadium: { name: "Nib Ground", city: "Addis Ababa", capacity: 5000, surfaceType: "artificial_turf", builtYear: 2005 },
    },
    {
        name: "Bench Maji Bunna FC",
        shortName: "BMB",
        city: "Mizan Teferi",
        foundedYear: 2007,
        description: "Coffee-sponsored club from the Bench Maji zone in southwestern Ethiopia.",
        website: "https://benchmajibunna.et",
        adminEmail: "admin@benchmajibunna.et",
        adminName: "Girma Eshetu",
        adminPhone: "+251912300005",
        stadium: { name: "Mizan Teferi Stadium", city: "Mizan Teferi", capacity: 6500, surfaceType: "natural_grass", builtYear: 2009 },
    },
    {
        name: "Shashemene Ketema FC",
        shortName: "SKF",
        city: "Shashemene",
        foundedYear: 1995,
        description: "Club from the commercial city of Shashemene in the Oromia region.",
        website: "https://shashemeneketema.et",
        adminEmail: "admin@shashemeneketema.et",
        adminName: "Haile Fikadu",
        adminPhone: "+251912300006",
        stadium: { name: "Shashemene Stadium", city: "Shashemene", capacity: 9000, surfaceType: "natural_grass", builtYear: 1998 },
    },
    {
        name: "Burayou FC",
        shortName: "BUR",
        city: "Burayou",
        foundedYear: 2012,
        description: "Club from Burayou, a rapidly growing town on the outskirts of Addis Ababa.",
        website: "https://burayoufc.et",
        adminEmail: "admin@burayoufc.et",
        adminName: "Ibsa Gebre",
        adminPhone: "+251912300007",
        stadium: { name: "Burayou Stadium", city: "Burayou", capacity: 5500, surfaceType: "natural_grass", builtYear: 2014 },
    },
    {
        name: "Akaki Kaliti FC",
        shortName: "AKK",
        city: "Addis Ababa",
        foundedYear: 2001,
        description: "Club from the Akaki Kaliti sub-city, the industrial heart of Addis Ababa.",
        website: "https://акакikaliti.et",
        adminEmail: "admin@акакikaliti.et",
        adminName: "Jemal Hailu",
        adminPhone: "+251912300008",
        stadium: { name: "Akaki Kaliti Ground", city: "Addis Ababa", capacity: 6000, surfaceType: "natural_grass", builtYear: 2003 },
    },
    {
        name: "Harar Ketema FC",
        shortName: "HRK",
        city: "Harar",
        foundedYear: 1988,
        description: "Historic club from the ancient walled city of Harar in eastern Ethiopia.",
        website: "https://hararketema.et",
        adminEmail: "admin@hararketema.et",
        adminName: "Kebede Ibsa",
        adminPhone: "+251912300009",
        stadium: { name: "Harar Stadium", city: "Harar", capacity: 8000, surfaceType: "natural_grass", builtYear: 1992 },
    },
    {
        name: "Nekemte Ketema FC",
        shortName: "NKF",
        city: "Nekemte",
        foundedYear: 1993,
        description: "Club from Nekemte, the capital of the East Wollega zone in the Oromia region.",
        website: "https://nekemteketema.et",
        adminEmail: "admin@nekemteketema.et",
        adminName: "Lemma Jima",
        adminPhone: "+251912300010",
        stadium: { name: "Nekemte Stadium", city: "Nekemte", capacity: 7500, surfaceType: "natural_grass", builtYear: 1996 },
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

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
    console.log("\n🌱  Ethiopian Higher League Group A — Phase 1 + Phase 2\n");

    // ── Verify EFF org ─────────────────────────────────────────────────────────
    const org = await prisma.organization.findUnique({ where: { name: EFF_ORG_NAME } });
    if (!org) throw new Error(`Organization "${EFF_ORG_NAME}" not found. Run seed-ethio.ts first.`);
    console.log(`✅  Org: ${org.name}  (${org.id})`);

    // ── Pre-fetch positions ────────────────────────────────────────────────────
    const allPositions = await prisma.position.findMany({ select: { id: true, code: true } });
    const positionIds: Record<string, number | null> = {};
    for (const p of allPositions) positionIds[p.code] = p.id;

    // ── Name queue — offset 464 to avoid EPL name collisions ──────────────────
    const nameQueue = buildNameQueue(464);
    let nameIdx = 0;
    const nextName = () => {
        if (nameIdx >= nameQueue.length) throw new Error("Ran out of unique name pairs!");
        return nameQueue[nameIdx++];
    };

    // ══════════════════════════════════════════════════════════════════════════
    // PHASE 1 — League + League Admin
    // ══════════════════════════════════════════════════════════════════════════
    console.log("\n── Phase 1: League + League Admin ──────────────────────────────\n");

    const leagueType = await prisma.leagueType.findFirst({ where: { name: "round_robin" } });

    const league = await prisma.league.upsert({
        where: { organizationId_name: { organizationId: org.id, name: "Ethiopian Higher League Group A" } },
        update: {
            leagueTypeId: leagueType?.id,
            genderCategory: "male",
            ageCategory: "senior",
            divisionLevel: 2,
            description:
                "Ethiopian Higher League Group A is the second tier of Ethiopian football, " +
                "Group A division, organized by the Ethiopian Football Federation. " +
                "The top clubs earn promotion to the Ethiopian Premier League.",
            status: "active",
        },
        create: {
            organizationId: org.id,
            name: "Ethiopian Higher League Group A",
            leagueTypeId: leagueType?.id,
            genderCategory: "male",
            ageCategory: "senior",
            divisionLevel: 2,
            description:
                "Ethiopian Higher League Group A is the second tier of Ethiopian football, " +
                "Group A division, organized by the Ethiopian Football Federation. " +
                "The top clubs earn promotion to the Ethiopian Premier League.",
            status: "active",
        },
    });
    console.log(`   ✅  League: "${league.name}"  (${league.id})`);

    const leagueAdminRoleId = await getRoleId("league_admin");
    const leagueAdmin = await prisma.user.upsert({
        where: { email: "leagueadmin@ehla.et" },
        update: {
            fullName: "EHLA Group A League Admin",
            passwordHash: await bcrypt.hash("password", 12),
            phone: "+251911500001",
            status: "active",
        },
        create: {
            fullName: "EHLA Group A League Admin",
            email: "leagueadmin@ehla.et",
            passwordHash: await bcrypt.hash("password", 12),
            phone: "+251911500001",
            status: "active",
        },
    });
    await assignRoleScope({
        userId: leagueAdmin.id,
        roleId: leagueAdminRoleId,
        organizationId: org.id,
        leagueId: league.id,
    });
    console.log(`   ✅  League Admin: leagueadmin@ehla.et / password`);

    // ══════════════════════════════════════════════════════════════════════════
    // PHASE 2 — Clubs + Stadiums + Club Admins + Players
    // ══════════════════════════════════════════════════════════════════════════
    console.log("\n── Phase 2: Clubs + Stadiums + Club Admins + Players ────────────\n");

    const clubAdminRoleId = await getRoleId("club_admin");

    for (const [idx, cd] of CLUBS.entries()) {
        // Stadium
        let stadium = await prisma.stadium.findFirst({ where: { name: cd.stadium.name } });
        if (!stadium) {
            stadium = await prisma.stadium.create({
                data: {
                    name: cd.stadium.name,
                    city: cd.stadium.city,
                    country: "Ethiopia",
                    capacity: cd.stadium.capacity,
                    surfaceType: cd.stadium.surfaceType,
                    builtYear: cd.stadium.builtYear,
                    description: `Home ground of ${cd.name}.`,
                },
            });
        }

        // Club
        let club = await prisma.club.findFirst({ where: { name: cd.name } });
        if (!club) {
            club = await prisma.club.create({
                data: {
                    name: cd.name,
                    shortName: cd.shortName,
                    country: "Ethiopia",
                    city: cd.city,
                    foundedYear: cd.foundedYear,
                    primaryStadiumId: stadium.id,
                    website: cd.website,
                    description: cd.description,
                    status: "active",
                    leagueId: league.id,
                },
            });
        } else {
            club = await prisma.club.update({
                where: { id: club.id },
                data: {
                    shortName: cd.shortName,
                    country: "Ethiopia",
                    city: cd.city,
                    foundedYear: cd.foundedYear,
                    primaryStadiumId: stadium.id,
                    website: cd.website,
                    description: cd.description,
                    status: "active",
                    leagueId: league.id,
                },
            });
        }

        // Link stadium owner
        await prisma.stadium.update({ where: { id: stadium.id }, data: { ownerClubId: club.id } });

        // Club admin
        const clubAdmin = await prisma.user.upsert({
            where: { email: cd.adminEmail },
            update: {
                fullName: cd.adminName,
                passwordHash: await bcrypt.hash("password", 12),
                phone: cd.adminPhone,
                status: "active",
            },
            create: {
                fullName: cd.adminName,
                email: cd.adminEmail,
                passwordHash: await bcrypt.hash("password", 12),
                phone: cd.adminPhone,
                status: "active",
            },
        });
        await assignRoleScope({
            userId: clubAdmin.id,
            roleId: clubAdminRoleId,
            organizationId: org.id,
            leagueId: league.id,
            clubId: club.id,
        });

        // 20 players with unique Ethiopian names
        const playerRows = SQUAD_POSITIONS.map((posCode, pi) => {
            const { firstName, lastName } = nextName();
            const birthYear = 1990 + (pi % 12);
            const month = String((pi % 12) + 1).padStart(2, "0");
            const day = String((pi % 28) + 1).padStart(2, "0");
            return {
                firstName,
                lastName,
                dateOfBirth: new Date(`${birthYear}-${month}-${day}`),
                nationality: pi % 10 === 9 ? "Kenyan" : "Ethiopian",
                heightCm: 165 + (pi % 20),
                weightKg: 60 + (pi % 15),
                preferredFoot: pi % 4 === 3 ? "left" : "right",
                primaryPositionId: positionIds[posCode] ?? null,
                status: "active",
                clubId: club.id,
            };
        });

        await prisma.player.createMany({ data: playerRows, skipDuplicates: false });

        console.log(
            `   [${String(idx + 1).padStart(2, "0")}] ${cd.name.padEnd(30)} | stadium: ${cd.stadium.name.padEnd(28)} | admin: ${cd.adminEmail}`
        );
    }

    // ── Summary ────────────────────────────────────────────────────────────────
    const clubCount = await prisma.club.count({ where: { leagueId: league.id } });
    const playerCount = await prisma.player.count({ where: { clubId: { not: null } } });

    console.log("\n" + "═".repeat(70));
    console.log("🎉  Phase 1 + Phase 2 complete!\n");
    console.log(`  League       : Ethiopian Higher League Group A`);
    console.log(`  League ID    : ${league.id}`);
    console.log(`  League Admin : leagueadmin@ehla.et  /  password`);
    console.log(`  Clubs        : ${clubCount}`);
    console.log(`  Players      : ${playerCount}  (20 per club, unique Ethiopian names)`);
    console.log(`  Club Admins  : admin@<clubdomain>.et  /  password`);
    console.log("  Next: run Phase 3 to create the 2025/26 season and register squads.");
    console.log("═".repeat(70));
}

main()
    .catch((e) => { console.error("\n❌  Failed:", e); process.exit(1); })
    .finally(() => prisma.$disconnect());
