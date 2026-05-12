import { PrismaClient } from "../src/generated/prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import * as dotenv from "dotenv"
dotenv.config()

const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) } as any)

async function main() {
  const token = process.env.META_PAGE_ACCESS_TOKEN
  if (!token) throw new Error("META_PAGE_ACCESS_TOKEN not set")

  const leads = await db.lead.findMany({
    where: { metaLeadId: { not: null }, adName: null },
    select: { id: true, metaLeadId: true },
  })

  console.log(`Found ${leads.length} leads with missing ad source`)

  let fixed = 0
  let failed = 0

  for (const lead of leads) {
    try {
      const res = await fetch(
        `https://graph.facebook.com/v19.0/${lead.metaLeadId}?fields=ad_name,campaign_name&access_token=${token}`
      )
      const data = await res.json()

      if (data.error) {
        console.log(`  ✗ ${lead.metaLeadId}: ${data.error.message}`)
        failed++
        continue
      }

      const adName: string | undefined = data.ad_name ?? undefined
      const campaignName: string | undefined = data.campaign_name ?? undefined

      if (!adName && !campaignName) {
        console.log(`  - ${lead.metaLeadId}: no ad/campaign data available`)
        failed++
        continue
      }

      await db.lead.update({
        where: { id: lead.id },
        data: { adName, campaignName },
      })

      console.log(`  ✓ ${lead.metaLeadId}: "${adName ?? "—"}" / "${campaignName ?? "—"}"`)
      fixed++
    } catch (err) {
      console.log(`  ✗ ${lead.metaLeadId}: ${err}`)
      failed++
    }

    // Avoid hammering the API
    await new Promise((r) => setTimeout(r, 150))
  }

  console.log(`\nDone: ${fixed} fixed, ${failed} could not be resolved`)
}

main().finally(() => db.$disconnect())
