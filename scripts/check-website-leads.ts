import { PrismaClient } from "../src/generated/prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import * as dotenv from "dotenv"
dotenv.config({ path: process.argv[2] ?? ".env.development.local" })

const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) } as any)

async function main() {
  const leads = await db.lead.findMany({
    where: { source: "WEBSITE" },
    select: { firstName: true, lastName: true, campaignName: true, adName: true, branch: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  })
  console.table(leads)
}

main().finally(() => db.$disconnect())
