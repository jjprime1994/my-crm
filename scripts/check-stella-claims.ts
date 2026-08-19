// One-off: find which of Stella's leads claimed "today" (MYT) falls outside the
// Team Breakdown's default 30-day createdAt window, explaining a 10-vs-9 count mismatch.
//
// Usage:  npx tsx scripts/check-stella-claims.ts [.env.development.local]

import { readFileSync } from "node:fs"
import { resolve } from "node:path"

const envFile = process.argv[2] ?? ".env.development.local"
for (const line of readFileSync(resolve(process.cwd(), envFile), "utf8").split("\n")) {
  const m = line.match(/^([A-Za-z0-9_]+)=(.*)$/)
  if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "")
}

async function main() {
  const { db } = await import("../src/lib/db")

  const MYT_OFFSET = 8 * 60 * 60 * 1000
  const nowMs = Date.now()
  const nowInMYT = nowMs + MYT_OFFSET
  const startOfDayInMYT = nowInMYT - (nowInMYT % (24 * 60 * 60 * 1000))
  const startOfDayUTC = new Date(startOfDayInMYT - MYT_OFFSET)
  const thirtyDaysAgo = new Date(nowMs - 30 * 24 * 60 * 60 * 1000)

  const stella = await db.user.findFirst({
    where: { name: { contains: "stella", mode: "insensitive" } },
    select: { id: true, name: true },
  })

  if (!stella) {
    console.log("No user found matching 'stella'")
    return
  }
  console.log(`User: ${stella.name} (${stella.id})`)

  const claimedToday = await db.lead.findMany({
    where: { claimedById: stella.id, claimedAt: { gte: startOfDayUTC } },
    select: { id: true, firstName: true, lastName: true, createdAt: true, claimedAt: true, source: true, assignedToId: true, status: true, assignedTo: { select: { name: true } } },
    orderBy: { claimedAt: "asc" },
  })

  console.log(`\nLeads claimed today (>= ${startOfDayUTC.toISOString()} UTC / MYT midnight): ${claimedToday.length}`)
  for (const l of claimedToday) {
    const createdOutsideDefaultWindow = l.createdAt < thirtyDaysAgo
    const displayName = [l.firstName, l.lastName].filter(Boolean).join(" ") || "(no name)"
    const reassigned = l.assignedToId !== stella.id
    console.log(
      `  - ${l.id}  ${displayName}  source=${l.source}  status=${l.status}` +
      `\n      createdAt=${l.createdAt.toISOString()}  claimedAt=${l.claimedAt?.toISOString()}` +
      `\n      assignedToId=${l.assignedToId ?? "null"} (${l.assignedTo?.name ?? "UNASSIGNED"})` +
      (createdOutsideDefaultWindow ? "  <-- created > 30 days ago: DROPPED from Team Breakdown's default 30d 'claimed' count" : "") +
      (reassigned ? "  <-- REASSIGNED AWAY FROM STELLA: dropped from Team Breakdown (scoped to current assignedToId), still counted in claimedById-based counts" : "")
    )
  }

  const missing = claimedToday.filter((l) => l.createdAt < thirtyDaysAgo)
  const reassignedAway = claimedToday.filter((l) => l.assignedToId !== stella.id)
  console.log(`\n${missing.length} of ${claimedToday.length} claimed-today lead(s) would be missing from the default (30d) Team Breakdown "claimed" count (createdAt outside window).`)
  console.log(`${reassignedAway.length} of ${claimedToday.length} claimed-today lead(s) are no longer assigned to Stella (reassigned away, dropped from any assignedToId-scoped "claimed" count).`)
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1) })
