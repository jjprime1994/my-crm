import { PrismaClient } from "../src/generated/prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import * as dotenv from "dotenv"
dotenv.config()

const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) } as any)

async function main() {
  const leads = await db.lead.findMany({
    orderBy: { createdAt: "desc" },
    take: 5,
    select: { metaLeadId: true, firstName: true, lastName: true, adName: true, adId: true, campaignId: true, createdAt: true },
  })
  console.log(JSON.stringify(leads, null, 2))
}

main().finally(() => db.$disconnect())
