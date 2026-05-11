import { PrismaClient } from "../src/generated/prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import * as dotenv from "dotenv"

dotenv.config()

const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) } as any)

const TOKEN = process.env.META_PAGE_ACCESS_TOKEN!
const FORM_ID = "1213518130735674"
const FORM_NAME = "Gorogoro Opening"

async function main() {
  const res = await fetch(
    `https://graph.facebook.com/v19.0/${FORM_ID}/leads?access_token=${TOKEN}&limit=100`
  )
  const data = await res.json()
  const leads = data.data ?? []

  let imported = 0
  let skipped = 0

  for (const lead of leads) {
    const fields: { name: string; values: string[] }[] = lead.field_data ?? []
    const get = (key: string) => fields.find((f) => f.name === key)?.values?.[0]

    const fullName = get("full_name") ?? ""
    const email = get("email")
    const phone = get("phone")

    // Skip test leads
    if (fullName.startsWith("<test lead")) { skipped++; continue }

    // Split full name into first/last
    const parts = fullName.trim().split(" ")
    const firstName = parts[0] ?? null
    const lastName = parts.slice(1).join(" ") || null

    try {
      await db.lead.upsert({
        where: { metaLeadId: lead.id },
        update: {},
        create: {
          metaLeadId: lead.id,
          formId: FORM_ID,
          adName: FORM_NAME,
          firstName,
          lastName,
          email,
          phone,
          createdAt: new Date(lead.created_time),
        },
      })
      imported++
      console.log(`✓ ${firstName} ${lastName ?? ""} — ${email ?? phone ?? "no contact"}`)
    } catch {
      skipped++
    }
  }

  console.log(`\nImported: ${imported} | Skipped: ${skipped}`)
}

main().finally(() => db.$disconnect())
