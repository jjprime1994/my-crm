import { PrismaClient } from "../src/generated/prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import * as dotenv from "dotenv"
dotenv.config({ path: process.argv[2] ?? ".env.development.local" })

const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) } as any)

async function main() {
  const bySource = await db.lead.groupBy({ by: ["source"], _count: { _all: true }, orderBy: { _count: { source: "desc" } } })
  console.log("=== Distinct `source` values ===")
  for (const r of bySource) console.log(`${String(r.source ?? "NULL").padEnd(40)} ${r._count._all}`)

  const byCampaign = await db.lead.groupBy({ by: ["campaignName"], _count: { _all: true }, orderBy: { _count: { campaignName: "desc" } } })
  console.log("\n=== Distinct `campaignName` values (what the Source filter uses) ===")
  for (const r of byCampaign) console.log(`${String(r.campaignName ?? "NULL").padEnd(60)} ${r._count._all}`)
}

main().finally(() => db.$disconnect())
