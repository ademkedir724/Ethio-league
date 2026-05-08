/**
 * rename-players.ts
 *
 * Assigns every player (and coach + referee) a unique, realistic Ethiopian name
 * drawn from a pool of 120 first names (60 Christian + 60 Muslim) and
 * 120 last names (60 Christian + 60 Muslim).
 *
 * Each player gets a deterministic but unique full name — no two players
 * will share the same firstName + lastName combination.
 *
 * Run with:  npx tsx prisma/rename-players.ts
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

// ─── 60 Ethiopian Christian male first names ──────────────────────────────────
const CHRISTIAN_FIRST = [
    "Abebe", "Aklilu", "Alemu", "Amanuel", "Andargachew", "Ashenafi", "Asnake", "Assefa",
    "Ayalew", "Ayele", "Berhane", "Berihun", "Biruk", "Dawit", "Dereje", "Ermias",
    "Eyob", "Fasil", "Fikadu", "Fikre", "Gebremichael", "Getachew", "Girma", "Habtamu",
    "Haile", "Henok", "Hiwot", "Kibrom", "Kiros", "Luel", "Mehari", "Mekonnen",
    "Mekdes", "Meles", "Mesfin", "Mulugeta", "Natnael", "Negash", "Netsanet", "Paulos",
    "Petros", "Rediet", "Robel", "Samuel", "Selemon", "Sintayehu", "Solomon", "Tadesse",
    "Tekeste", "Tesfaye", "Tewodros", "Tigist", "Tsegay", "Wondwosen", "Worku", "Yared",
    "Yohannes", "Yonas", "Zerihun", "Zewdu",
];

// ─── 60 Ethiopian Muslim male first names ─────────────────────────────────────
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

// ─── 60 Ethiopian Christian male last names (father's name style) ─────────────
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

// ─── 60 Ethiopian Muslim male last names (father's name style) ────────────────
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

// Combined pools
const ALL_FIRST = [...CHRISTIAN_FIRST, ...MUSLIM_FIRST]; // 120 names
const ALL_LAST = [...CHRISTIAN_LAST, ...MUSLIM_LAST];  // 120 names

// ─── Generate a shuffled unique-pair sequence ─────────────────────────────────
// We need up to 400 players + 20 coaches + 44 referees = ~464 unique names.
// With 120×120 = 14,400 possible combinations we have plenty of room.
// Strategy: shuffle both arrays with a fixed seed, then pair index i with
// ALL_FIRST[i % 120] and ALL_LAST[Math.floor(i / 120) % 120], but to avoid
// repeats we track used pairs.

function seededShuffle<T>(arr: T[], seed: number): T[] {
    const a = [...arr];
    let s = seed >>> 0;
    const rand = () => {
        s ^= s << 13; s ^= s >> 17; s ^= s << 5;
        return (s >>> 0) / 4294967296;
    };
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(rand() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

function buildNameQueue(): Array<{ firstName: string; lastName: string }> {
    // Shuffle both pools independently with different seeds
    const firsts = seededShuffle(ALL_FIRST, 0xdeadbeef);
    const lasts = seededShuffle(ALL_LAST, 0xcafebabe);

    const pairs: Array<{ firstName: string; lastName: string }> = [];
    const used = new Set<string>();

    // Generate enough unique pairs
    for (let li = 0; li < lasts.length; li++) {
        for (let fi = 0; fi < firsts.length; fi++) {
            const key = `${firsts[fi]}|${lasts[li]}`;
            if (!used.has(key)) {
                used.add(key);
                pairs.push({ firstName: firsts[fi], lastName: lasts[li] });
                if (pairs.length >= 600) return pairs; // more than enough
            }
        }
    }
    return pairs;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
    console.log("\n✏️   rename-players.ts — assigning unique Ethiopian names\n");

    const nameQueue = buildNameQueue();
    let nameIdx = 0;
    const nextName = () => {
        if (nameIdx >= nameQueue.length) throw new Error("Ran out of unique name pairs!");
        return nameQueue[nameIdx++];
    };

    // ── Players ────────────────────────────────────────────────────────────────
    const players = await prisma.player.findMany({ orderBy: { createdAt: "asc" } });
    console.log(`   Renaming ${players.length} players...`);
    for (const p of players) {
        const { firstName, lastName } = nextName();
        await prisma.player.update({ where: { id: p.id }, data: { firstName, lastName } });
    }
    console.log(`   ✅  Players renamed (${players.length})`);

    // ── Coaches ────────────────────────────────────────────────────────────────
    const coaches = await prisma.coach.findMany({ orderBy: { createdAt: "asc" } });
    console.log(`   Renaming ${coaches.length} coaches...`);
    for (const c of coaches) {
        const { firstName, lastName } = nextName();
        await prisma.coach.update({ where: { id: c.id }, data: { firstName, lastName } });
    }
    console.log(`   ✅  Coaches renamed (${coaches.length})`);

    // ── Referees ───────────────────────────────────────────────────────────────
    const referees = await prisma.referee.findMany({ orderBy: { createdAt: "asc" } });
    console.log(`   Renaming ${referees.length} referees...`);
    for (const r of referees) {
        const { firstName, lastName } = nextName();
        await prisma.referee.update({ where: { id: r.id }, data: { firstName, lastName } });
    }
    console.log(`   ✅  Referees renamed (${referees.length})`);

    console.log(`\n   Total names assigned: ${nameIdx}`);
    console.log("   ✅  Done — every player, coach and referee now has a unique Ethiopian name.\n");
}

main()
    .catch((e) => { console.error("\n❌  Failed:", e); process.exit(1); })
    .finally(() => prisma.$disconnect());
