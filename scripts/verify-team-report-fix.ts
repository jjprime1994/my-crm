// Verifies the getTeamReport() fix: Stella's "claimed" count should be 10 for every period
// that includes today, matching the raw claimedById count — regardless of when the
// underlying leads were created.
//
// Usage:  npx tsx scripts/verify-team-report-fix.ts [.env.development.local]

import { readFileSync } from "node:fs"
import { resolve } from "node:path"

const envFile = process.argv[2] ?? ".env.development.local"
for (const line of readFileSync(resolve(process.cwd(), envFile), "utf8").split("\n")) {
  const m = line.match(/^([A-Za-z0-9_]+)=(.*)$/)
  if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "")
}

async function main() {
  const { db } = await import("../src/lib/db")
  const { getTeamReport } = await import("../src/lib/team-report")

  const stella = await db.user.findFirst({
    where: { name: { contains: "stella", mode: "insensitive" } },
    select: { id: true, name: true },
  })
  if (!stella) { console.log("No user found matching 'stella'"); return }

  const rawClaimedToday = await db.lead.count({
    where: { claimedById: stella.id, claimedAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
  })
  console.log(`Raw claimedById count (last 24h, sanity check): ${rawClaimedToday}`)

  for (const days of [7, 30, 90]) {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
    const report = await getTeamReport(since, null)
    const row = report.find((r) => r.id === stella.id)
    console.log(`period=${days}d  claimed=${row?.claimed ?? "MISSING"}  totalLeads=${row?.totalLeads}`)
  }

  const allTime = await getTeamReport(null, null)
  const allTimeRow = allTime.find((r) => r.id === stella.id)
  console.log(`period=all-time  claimed=${allTimeRow?.claimed ?? "MISSING"}  totalLeads=${allTimeRow?.totalLeads}`)
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1) })
