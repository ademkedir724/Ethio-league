/**
 * seed-higher-league-b.ts  —  Phase 1 + Phase 2
 *
 * Phase 1: League "Ethiopian Higher League Group B" + League Admin
 * Phase 2: 8 clubs + stadiums + club admins + 20 players each
 *
 * Run with:  npx tsx prisma/seed-higher-league-b.ts
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

const EFF_ORG_NAME = "Ethiopian Football Federation";

// ─── Name pools (same 120-name pools as Group A) ─────────────────────────────
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

// Group A used offsets 464–623 (160 names for 8 clubs × 20 players).
// Group B starts at offset 624 to guarantee no collisions.
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

const SQUAD_POSITIONS = [
    "GK", "GK", "CB", "CB", "RB", "LB", "CDM", "CDM", "CM", "CM",
    "CAM", "LW", "RW", "ST", "ST", "CF", "CB", "CM", "LW", "RW",
];

// ─── Club definitions ─────────────────────────────────────────────────────────
const CLUBS = [
    {
        name: "Halaba Ketema FC",
        shortName: "HLB",
        city: "Halaba",
        foundedYear: 2002,
        description: "Current league leader from Halaba in the SNNPR region of southern Ethiopia.",
        website: "https://halabaketema.et",
        adminEmail: "admin@halabaketema.et",
        adminName: "Tesfaye Bekele",
        adminPhone: "+251913400001",
        stadium: { name: "Halaba Stadium", city: "Halaba", capacity: 7000, surfaceType: "natural_grass", builtYear: 2005 },
    },
    {
        name: "Dese Ketema FC",
        shortName: "DSK",
        city: "Dessie",
        foundedYear: 1985,
        description: "Historic club from Dessie, the capital of South Wollo zone in the Amhara region.",
        website: "https://desesketema.et",
        adminEmail: "admin@desesketema.et",
        adminName: "Girma Haile",
        adminPhone: "+251913400002",
        stadium: { name: "Dessie Stadium", city: "Dessie", capacity: 12000, surfaceType: "natural_grass", builtYear: 1990 },
    },
    {
        name: "Bishoftu Ketema FC",
        shortName: "BSH",
        city: "Bishoftu",
        foundedYear: 1997,
        description: "Club from Bishoftu (Debre Zeit), a lakeside city in the Oromia region near Addis Ababa.",
        website: "https://bishoftuketema.et",
        adminEmail: "admin@bishoftuketema.et",
        adminName: "Dawit Tadesse",
        adminPhone: "+251913400003",
        stadium: { name: "Bishoftu Stadium", city: "Bishoftu", capacity: 9000, surfaceType: "natural_grass", builtYear: 2000 },
    },
    {
        name: "Addis Ketema FC",
        shortName: "ADK",
        city: "Addis Ababa",
        foundedYear: 2008,
        description: "Club from the Addis Ketema sub-city in the heart of Addis Ababa.",
        website: "https://addisketema.et",
        adminEmail: "admin@addisketema.et",
        adminName: "Mulugeta Alemu",
        adminPhone: "+251913400004",
        stadium: { name: "Addis Ketema Ground", city: "Addis Ababa", capacity: 6000, surfaceType: "artificial_turf", builtYear: 2010 },
    },
    {
        name: "Menge FC",
        shortName: "MNG",
        city: "Menge",
        foundedYear: 2003,
        description: "Club from Menge in the Benishangul-Gumuz region of western Ethiopia.",
        website: "https://mengefc.et",
        adminEmail: "admin@mengefc.et",
        adminName: "Henok Gebre",
        adminPhone: "+251913400005",
        stadium: { name: "Menge Stadium", city: "Menge", capacity: 5000, surfaceType: "natural_grass", builtYear: 2006 },
    },
    {
        name: "Debre Birhan Ketema FC",
        shortName: "DBK",
        city: "Debre Birhan",
        foundedYear: 1992,
        description: "Club from Debre Birhan, the capital of North Shewa zone in the Amhara region.",
        website: "https://debrebirhanketema.et",
        adminEmail: "admin@debrebirhanketema.et",
        adminName: "Yonas Negash",
        adminPhone: "+251913400006",
        stadium: { name: "Debre Birhan Stadium", city: "Debre Birhan", capacity: 8000, surfaceType: "natural_grass", builtYear: 1995 },
    },
    {
        name: "Soloda Adwa FC",
        shortName: "SAD",
        city: "Adwa",
        foundedYear: 1999,
        description: "Club from the historic city of Adwa in the Tigray region, site of the famous 1896 battle.",
        website: "https://soladaadwa.et",
        adminEmail: "admin@soladaadwa.et",
        adminName: "Amanuel Worku",
        adminPhone: "+251913400007",
        stadium: { name: "Adwa Stadium", city: "Adwa", capacity: 7500, surfaceType: "natural_grass", builtYear: 2002 },
    },
    {
        name: "Boditi Ketema FC",
        shortName: "BDT",
        city: "Boditi",
        foundedYear: 2006,
        description: "Club from Boditi in the Wolayita zone of the SNNPR region.",
        website: "https://boditiketema.et",
        adminEmail: "admin@boditiketema.et",
        adminName: "Biruk Demeke",
        adminPhone: "+251913400008",
        stadium: { name: "Boditi Stadium", city: "Boditi", capacity: 6500, surfaceType: "natural_grass", builtYear: 2008 },
    },
    {
        name: "Nifas Silk Lafto FC",
        shortName: "NSL",
        city: "Addis Ababa",
        foundedYear: 2011,
        description: "Club from the Nifas Silk Lafto sub-city, one of the fastest-growing areas of Addis Ababa.",
        website: "https://nifassilklafto.et",
        adminEmail: "admin@nifassilklafto.et",
        adminName: "Ermias Kebede",
        adminPhone: "+251913400009",
        stadium: { name: "Nifas Silk Lafto Ground", city: "Addis Ababa", capacity: 6000, surfaceType: "artificial_turf", builtYear: 2013 },
    },
    {
        name: "Sululta Ketema FC",
        shortName: "SUL",
        city: "Sululta",
        foundedYear: 2009,
        description: "Club from Sululta, a rapidly growing town in the Oromia Special Zone surrounding Addis Ababa.",
        website: "https://sulultaketema.et",
        adminEmail: "admin@sulultaketema.et",
        adminName: "Fasil Eshetu",
        adminPhone: "+251913400010",
        stadium: { name: "Sululta Stadium", city: "Sululta", capacity: 7000, surfaceType: "natural_grass", builtYear: 2012 },
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
    console.log("\n🌱  Ethiopian Higher League Group B — Phase 1 + Phase 2\n");

    // ── Verify EFF org ─────────────────────────────────────────────────────────
    const org = await prisma.organization.findUnique({ where: { name: EFF_ORG_NAME } });
    if (!org) throw new Error(`Organization "${EFF_ORG_NAME}" not found. Run seed-ethio.ts first.`);
    console.log(`✅  Org: ${org.name}  (${org.id})`);

    // ── Pre-fetch positions ────────────────────────────────────────────────────
    const allPositions = await prisma.position.findMany({ select: { id: true, code: true } });
    const positionIds: Record<string, number | null> = {};
    for (const p of allPositions) positionIds[p.code] = p.id;

    // ── Name queue — offset 624 to avoid all previous collisions ──────────────
    // EPL: 0–463, Group A: 464–623, Group B: 624+
    const nameQueue = buildNameQueue(624);
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
        where: { organizationId_name: { organizationId: org.id, name: "Ethiopian Higher League Group B" } },
        update: {
            leagueTypeId: leagueType?.id,
            genderCategory: "male",
            ageCategory: "senior",
            divisionLevel: 2,
            description:
                "Ethiopian Higher League Group B is the second tier of Ethiopian football, " +
                "Group B division, organized by the Ethiopian Football Federation. " +
                "The top clubs earn promotion to the Ethiopian Premier League.",
            status: "active",
        },
        create: {
            organizationId: org.id,
            name: "Ethiopian Higher League Group B",
            leagueTypeId: leagueType?.id,
            genderCategory: "male",
            ageCategory: "senior",
            divisionLevel: 2,
            description:
                "Ethiopian Higher League Group B is the second tier of Ethiopian football, " +
                "Group B division, organized by the Ethiopian Football Federation. " +
                "The top clubs earn promotion to the Ethiopian Premier League.",
            status: "active",
        },
    });
    console.log(`   ✅  League: "${league.name}"  (${league.id})`);

    const leagueAdminRoleId = await getRoleId("league_admin");
    const leagueAdmin = await prisma.user.upsert({
        where: { email: "leagueadmin@ehlb.et" },
        update: {
            fullName: "EHLB Group B League Admin",
            passwordHash: await bcrypt.hash("password", 12),
            phone: "+251911600001",
            status: "active",
        },
        create: {
            fullName: "EHLB Group B League Admin",
            email: "leagueadmin@ehlb.et",
            passwordHash: await bcrypt.hash("password", 12),
            phone: "+251911600001",
            status: "active",
        },
    });
    await assignRoleScope({
        userId: leagueAdmin.id,
        roleId: leagueAdminRoleId,
        organizationId: org.id,
        leagueId: league.id,
    });
    console.log(`   ✅  League Admin: leagueadmin@ehlb.et / password`);

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
            `   [${String(idx + 1).padStart(2, "0")}] ${cd.name.padEnd(28)} | stadium: ${cd.stadium.name.padEnd(26)} | admin: ${cd.adminEmail}`
        );
    }

    // ── Summary ────────────────────────────────────────────────────────────────
    const clubIds = (await prisma.club.findMany({ where: { leagueId: league.id }, select: { id: true } })).map(c => c.id);
    const playerCount = await prisma.player.count({ where: { clubId: { in: clubIds } } });

    console.log("\n" + "=".repeat(70));
    console.log("Phase 1 + Phase 2 complete!\n");
    console.log("  League       : Ethiopian Higher League Group B");
    console.log("  League ID    : " + league.id);
    console.log("  League Admin : leagueadmin@ehlb.et  /  password");
    console.log("  Clubs        : " + CLUBS.length);
    console.log("  Players      : " + playerCount + "  (20 per club, unique Ethiopian names)");
    console.log("  Club Admins  : admin@<clubdomain>.et  /  password");
    console.log("=".repeat(70));
}

main()
    .catch((e) => { console.error("\n  Failed:", e); process.exit(1); })
    .finally(() => prisma.$disconnect());
