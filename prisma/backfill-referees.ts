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
    const org = await prisma.organization.findUnique({
        where: { name: "Ethiopian Football Federation" },
    });
    if (!org) throw new Error("EFF org not found");

    const result = await prisma.referee.updateMany({
        where: { organizationId: null },
        data: { organizationId: org.id },
    });

    console.log(`Backfilled ${result.count} referees → org: ${org.id}`);

    const total = await prisma.referee.count({ where: { organizationId: org.id } });
    console.log(`Total referees linked to EFF: ${total}`);
}

main()
    .catch((e) => { console.error(e); process.exit(1); })
    .finally(() => prisma.$disconnect());
