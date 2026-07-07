import { PrismaClient } from "../src/generated/prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import * as dotenv from "dotenv"
dotenv.config()

const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) } as any)

async function main() {
  const lead = await db.lead.findFirst({
    where: {
      OR: [
        { firstName: { contains: "Auni", mode: "insensitive" } },
        { lastName: { contains: "Alabar", mode: "insensitive" } },
      ],
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true, firstName: true, lastName: true,
      adId: true, adName: true, campaignId: true, campaignName: true,
      formId: true, source: true, branch: true, createdAt: true, rawData: true,
    },
  })

  if (!lead) { console.log("Lead not found"); return }

  const raw = lead.rawData as Record<string, unknown> | null
  console.log("=== Lead ===")
  console.log(`Name:       ${lead.firstName} ${lead.lastName}`)
  console.log(`Created:    ${lead.createdAt.toISOString()}`)
  console.log(`source:     ${lead.source ?? "NULL"}`)
  console.log(`adName:     ${lead.adName ?? "NULL"}`)
  console.log(`campaignName: ${lead.campaignName ?? "NULL"}`)
  console.log(`branch:     ${lead.branch ?? "NULL"}`)
  console.log("\n=== Raw webhook payload ===")
  console.log(`form_id:    ${raw?.form_id ?? "MISSING"}`)
  console.log(`ad_id:      ${raw?.ad_id ?? "MISSING"}`)
  console.log(`campaign_id:${raw?.campaign_id ?? "MISSING"}`)
  console.log(`leadgen_id: ${raw?.leadgen_id ?? "MISSING"}`)
  console.log(`field_data: ${JSON.stringify(raw?.field_data ?? [])}`)
}

main().finally(() => db.$disconnect())
