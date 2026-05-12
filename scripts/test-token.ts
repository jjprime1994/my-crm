import { PrismaClient } from "../src/generated/prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import * as dotenv from "dotenv"
dotenv.config()

const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) } as any)

async function main() {
  const updated = await db.lead.update({
    where: { metaLeadId: "1006227928643365" },
    data: { adName: "New Leads ad", campaignName: "Location Ads" },
    select: { firstName: true, adName: true, campaignName: true },
  })
  console.log("Patched:", JSON.stringify(updated))
}

main().finally(() => db.$disconnect())
