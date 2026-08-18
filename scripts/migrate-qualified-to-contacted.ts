// One-time migration: the Qualified stage was removed from the pipeline
// (New -> Contacted -> Appointment Made -> Won/Lost). Reclassifies every lead
// currently sitting at QUALIFIED back to CONTACTED, logging a LeadStatusHistory
// row and an explanatory LeadNote on each so the change is auditable.
//
// Usage: npx tsx scripts/migrate-qualified-to-contacted.ts [--dry-run] [.env.production.local]
import { readFileSync } from "node:fs"
import { resolve } from "node:path"

const dryRun = process.argv.includes("--dry-run")
const envFile = process.argv.find((a) => a.endsWith(".local")) ?? ".env.development.local"
for (const line of readFileSync(resolve(process.cwd(), envFile), "utf8").split("\n")) {
  const m = line.match(/^([A-Za-z0-9_]+)=(.*)$/)
  if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "")
}

async function main() {
  const { db } = await import("../src/lib/db")

  const leads = await db.lead.findMany({
    where: { status: "QUALIFIED" },
    select: { id: true, firstName: true, lastName: true },
  })

  console.log(`Found ${leads.length} lead(s) at QUALIFIED.`)
  if (dryRun || leads.length === 0) {
    if (dryRun) console.log("Dry run — no changes made.")
    process.exit(0)
  }

  for (const lead of leads) {
    await db.lead.update({ where: { id: lead.id }, data: { status: "CONTACTED" } })
    await db.leadStatusHistory.create({
      data: { leadId: lead.id, from: "QUALIFIED", to: "CONTACTED", changedById: null },
    })
    await db.leadNote.create({
      data: {
        leadId: lead.id,
        authorId: null,
        isSystem: true,
        content: "Reclassified from Qualified to Contacted — the Qualified stage was removed from the pipeline.",
      },
    })
    console.log(`  Migrated ${lead.firstName ?? ""} ${lead.lastName ?? ""} (${lead.id})`)
  }

  console.log(`Done. Migrated ${leads.length} lead(s).`)
  process.exit(0)
}
main().catch((e) => { console.error(e); process.exit(1) })
