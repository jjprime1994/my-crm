// Are a Meta campaign's leads reaching the CRM? (read-only)
// Usage:  npx tsx scripts/check-campaign-leads.ts <campaignId | name substring> [.env.production.local]

import { readFileSync } from "node:fs"
import { resolve } from "node:path"

const query = process.argv[2]
if (!query) {
  console.error("Usage: npx tsx scripts/check-campaign-leads.ts <campaignId | name substring> [.env.production.local]")
  process.exit(1)
}
const envFile = process.argv[3] ?? ".env.production.local"
for (const line of readFileSync(resolve(process.cwd(), envFile), "utf8").split("\n")) {
  const m = line.match(/^([A-Za-z0-9_]+)=(.*)$/)
  if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "")
}

async function main() {
  const { db } = await import("../src/lib/db")
  const isId = /^\d+$/.test(query)

  const excluded = await db.excludedCampaign.findMany({
    where: isId ? { campaignId: query } : { campaignName: { contains: query, mode: "insensitive" } },
  })
  console.log("Excluded-campaign rows:", excluded.length ? excluded : "none (not excluded)")

  const where = isId
    ? { campaignId: query }
    : { OR: [{ campaignName: { contains: query, mode: "insensitive" as const } }, { adName: { contains: query, mode: "insensitive" as const } }] }
  const leads = await db.lead.findMany({
    where,
    select: { createdAt: true, status: true, branch: true, adName: true, campaignName: true, isDuplicate: true, assignedTo: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
  })

  console.log(`\nCRM leads matching "${query}": ${leads.length}`)
  const unassigned = leads.filter((l) => !l.assignedTo).length
  console.log(`  assigned: ${leads.length - unassigned}, unassigned (in Available Leads): ${unassigned}, duplicates: ${leads.filter((l) => l.isDuplicate).length}`)
  for (const l of leads.slice(0, 30)) {
    const myt = new Date(l.createdAt.getTime() + 8 * 3600_000).toISOString().slice(0, 16).replace("T", " ")
    console.log(`  ${myt} MYT  ${l.status.padEnd(11)} ${(l.branch ?? "-").padEnd(10)} ${l.assignedTo?.name ?? "(unassigned)"}  | ${l.campaignName ?? "(no campaign name)"} / ${l.adName ?? "-"}`)
  }
  process.exit(0)
}
main().catch((e) => { console.error(e); process.exit(1) })
