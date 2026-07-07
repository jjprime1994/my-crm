// Timeline check for the "Inhouse Event  20-21 June" mis-claims (read-only).
// Usage:  npx tsx scripts/inspect-adroute-timeline.ts [.env.production.local]

import { readFileSync } from "node:fs"
import { resolve } from "node:path"

const envFile = process.argv[2] ?? ".env.production.local"
for (const line of readFileSync(resolve(process.cwd(), envFile), "utf8").split("\n")) {
  const m = line.match(/^([A-Za-z0-9_]+)=(.*)$/)
  if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "")
}

async function main() {
  const { db } = await import("../src/lib/db")

  const route = await db.adRoute.findFirst({ where: { adName: "Inhouse Event  20-21 June" } })
  console.log("AdRoute 'Inhouse Event  20-21 June':")
  console.log(`  created: ${route?.createdAt.toISOString()}   updated: ${route?.updatedAt.toISOString()}   archived: ${route?.archived}`)

  const claimers = await db.user.findMany({
    where: { name: { in: ["Choo Yun Wah", "Willam Tan", "Wan Luqman"] } },
    select: { id: true, name: true, role: true, claimLimit: true, managerId: true,
      manager: { select: { name: true } } },
  })
  console.log("\nClaimers:")
  for (const u of claimers) {
    console.log(`  ${u.name}: role ${u.role}, claimLimit ${u.claimLimit}, manager ${u.manager?.name ?? "NONE"}`)
  }

  // All leads for this ad: where did the rest go?
  const eventLeads = await db.lead.findMany({
    where: { adName: "Inhouse Event  20-21 June" },
    select: { status: true, assignedTo: { select: { name: true, manager: { select: { name: true } } } } },
  })
  const byHolder = new Map<string, number>()
  for (const l of eventLeads) {
    const key = l.assignedTo ? `${l.assignedTo.name} (team ${l.assignedTo.manager?.name ?? "—"})` : "UNASSIGNED"
    byHolder.set(key, (byHolder.get(key) ?? 0) + 1)
  }
  console.log(`\nAll ${eventLeads.length} leads with this adName, by holder:`)
  for (const [who, n] of [...byHolder.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${String(n).padStart(3)}  ${who}`)
  }
  process.exit(0)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
