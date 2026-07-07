// One-off: remove the two synthetic WEBSITE leads created while testing the website webhook.
import { PrismaClient } from "../src/generated/prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import * as dotenv from "dotenv"
dotenv.config({ path: process.argv[2] ?? ".env.development.local" })

const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) } as any)

const where = {
  source: "WEBSITE",
  OR: [
    { firstName: "LiveSite", lastName: "LiveTest" },
    { firstName: "ClaudeTest", lastName: "WebhookCheck" },
  ],
}

async function main() {
  const targets = await db.lead.findMany({
    where,
    select: { id: true, firstName: true, lastName: true, source: true, createdAt: true, assignedToId: true },
  })
  console.table(targets)
  if (targets.length !== 2) {
    console.error(`Expected exactly 2 test leads, found ${targets.length} — aborting.`)
    process.exitCode = 1
    return
  }
  const res = await db.lead.deleteMany({ where: { id: { in: targets.map((t) => t.id) } } })
  console.log(`Deleted ${res.count} test leads.`)
}

main().finally(() => db.$disconnect())
