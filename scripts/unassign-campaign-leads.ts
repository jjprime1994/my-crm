// Unassign a Meta campaign's leads (back to the Available Leads pool) — DRY RUN unless --apply.
// Only touches open leads (not Won/Lost) that nobody has worked yet (status NEW, no notes).
// Usage:  npx tsx scripts/unassign-campaign-leads.ts <campaignId> [--apply] [.env.production.local]

import { readFileSync } from "node:fs"
import { resolve } from "node:path"

const args = process.argv.slice(2)
const apply = args.includes("--apply")
const [campaignId, envArg] = args.filter((a) => a !== "--apply")
if (!campaignId || !/^\d+$/.test(campaignId)) {
  console.error("Usage: npx tsx scripts/unassign-campaign-leads.ts <campaignId> [--apply] [.env.production.local]")
  process.exit(1)
}
const envFile = envArg ?? ".env.production.local"
for (const line of readFileSync(resolve(process.cwd(), envFile), "utf8").split("\n")) {
  const m = line.match(/^([A-Za-z0-9_]+)=(.*)$/)
  if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "")
}

async function main() {
  const { db } = await import("../src/lib/db")

  const leads = await db.lead.findMany({
    where: { campaignId, assignedToId: { not: null }, status: "NEW", notes: { none: {} } },
    select: { id: true, createdAt: true, branch: true, adName: true, assignedTo: { select: { name: true } } },
    orderBy: { createdAt: "asc" },
  })
  const skipped = await db.lead.count({
    where: { campaignId, assignedToId: { not: null }, NOT: { status: "NEW", notes: { none: {} } } },
  })

  const byPerson: Record<string, number> = {}
  for (const l of leads) byPerson[l.assignedTo!.name] = (byPerson[l.assignedTo!.name] ?? 0) + 1
  console.log(`Campaign ${campaignId}: ${leads.length} untouched assigned lead(s) to unassign`)
  for (const [name, n] of Object.entries(byPerson)) console.log(`  ${name}: ${n}`)
  if (skipped) console.log(`Skipping ${skipped} lead(s) already worked (status changed or has notes)`)

  // Where will they show up? Available Leads routes by adName via AdRoute.
  const adNames = [...new Set(leads.map((l) => l.adName).filter((n): n is string => !!n))]
  const routes = await db.adRoute.findMany({ where: { adName: { in: adNames }, archived: false }, select: { adName: true, teamIds: true, userIds: true } })
  const teamIds = [...new Set(routes.flatMap((r) => r.teamIds))]
  const teams = await db.user.findMany({ where: { id: { in: teamIds } }, select: { id: true, name: true } })
  const teamName = Object.fromEntries(teams.map((t) => [t.id, t.name]))
  console.log("\nAd routes for these leads' ad name(s):")
  for (const n of adNames) {
    const r = routes.find((x) => x.adName === n)
    console.log(`  "${n}" → ${r ? r.teamIds.map((id) => teamName[id] ?? id).join(", ") || "(no teams)" : "NO AD ROUTE (will fall to default team's pool)"}`)
  }

  if (!apply) {
    console.log("\nDry run — nothing changed. Re-run with --apply to unassign.")
    process.exit(0)
  }

  const ids = leads.map((l) => l.id)
  const res = await db.lead.updateMany({
    where: { id: { in: ids }, status: "NEW" },
    data: { assignedToId: null, claimedById: null, claimedAt: null },
  })
  console.log(`\nUnassigned ${res.count} lead(s).`)
  process.exit(0)
}
main().catch((e) => { console.error(e); process.exit(1) })
