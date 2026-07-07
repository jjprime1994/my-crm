// Detail dump for the leads flagged by check-assignments.ts (read-only).
// Usage:  npx tsx scripts/inspect-flagged-leads.ts [.env.production.local]

import { readFileSync } from "node:fs"
import { resolve } from "node:path"

const envFile = process.argv[2] ?? ".env.production.local"
for (const line of readFileSync(resolve(process.cwd(), envFile), "utf8").split("\n")) {
  const m = line.match(/^([A-Za-z0-9_]+)=(.*)$/)
  if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "")
}

const IDS = [
  "cmqnlisux000604jsbzgoo5oc", "cmqlwi67f000604l4asehnucg", "cmqlv63zc000304l1y7r5wt2g",
  "cmqlv62ib000204l1vr11fihv", "cmqlrxvnh000a04jpxi8q7ko9", "cmqlrak5o000604jpgzz690hy",
  "cmql8h8rs000104ju4415x0lg", "cmql6rmdm000404i6r9d14nzc", "cmql666or000204junc2a6zq8",
  "cmql5p117000a04l8y5bn4w1j", "cmql321lt000304jo1bada94s", "cmql2fjpi000004k01j3v95w5",
  "cmqjasi89000d04jxf9bk1l9h", "cmqit800l000n04l1j8yej757", "cmqis5m3o000704l7srs1902w",
  "cmqg6s775000b04ky81x2f9fl", "cmqfhjl5s000004i9l60t5gov",
]

async function main() {
  const { db } = await import("../src/lib/db")

  const leads = await db.lead.findMany({
    where: { id: { in: IDS } },
    select: {
      id: true, firstName: true, lastName: true, branch: true, adName: true, campaignName: true,
      source: true, createdAt: true, claimedAt: true,
      assignedTo: { select: { name: true, role: true, manager: { select: { name: true } } } },
      claimedBy: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
  })

  for (const l of leads) {
    const name = [l.firstName, l.lastName].filter(Boolean).join(" ") || "(no name)"
    console.log(`${name}`)
    console.log(`  branch: ${l.branch ?? "—"}   adName: ${l.adName ?? "—"}`)
    console.log(`  campaign: ${l.campaignName ?? "—"}`)
    console.log(`  held by: ${l.assignedTo?.name} (${l.assignedTo?.role}, manager: ${l.assignedTo?.manager?.name ?? "—"})   claimedBy: ${l.claimedBy?.name ?? "—"}`)
    console.log("")
  }

  // Routing config relevant to these leads
  const adNames = [...new Set(leads.map((l) => l.adName).filter(Boolean))] as string[]
  const routes = await db.adRoute.findMany({ where: { adName: { in: adNames } } })
  const admins = await db.user.findMany({
    where: { role: { in: ["ADMIN", "SUPER_ADMIN"] } },
    select: { id: true, name: true, coveredStates: true, isDefaultTeam: true },
  })
  const adminName = new Map(admins.map((a) => [a.id, a.name]))
  console.log("--- AdRoutes for these leads' ad names ---")
  for (const r of routes) {
    console.log(`  "${r.adName}" -> [${r.teamIds.map((t) => adminName.get(t) ?? t).join(", ")}]${r.archived ? "  (ARCHIVED)" : ""}`)
  }
  const unrouted = adNames.filter((a) => !routes.some((r) => r.adName === a))
  if (unrouted.length) console.log(`  unrouted ad names: ${unrouted.map((a) => `"${a}"`).join(", ")}`)
  console.log("\n--- Admin teams ---")
  for (const a of admins) {
    console.log(`  ${a.name}: states [${a.coveredStates.join(", ")}]${a.isDefaultTeam ? "  (DEFAULT)" : ""}`)
  }
  process.exit(0)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
