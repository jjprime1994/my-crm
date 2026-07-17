// Verifies the lead-routing invariants in CLAUDE.md ("Lead Routing Rules")
// against a live database, using the real production code paths.
//
// Usage:  npx tsx scripts/check-routing.ts [.env.development.local]
// Exit 0 = all invariants hold; exit 1 = violations printed below.

import { readFileSync } from "node:fs"
import { resolve } from "node:path"

const envFile = process.argv[2] ?? ".env.development.local"
for (const line of readFileSync(resolve(process.cwd(), envFile), "utf8").split("\n")) {
  const m = line.match(/^([A-Za-z0-9_]+)=(.*)$/)
  if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "")
}

async function main() {
// Import after env is set so db.ts sees DATABASE_URL.
const { db } = await import("../src/lib/db")
const { getAvailableLeads, getAvailableLeadsCount } = await import("../src/lib/available-leads")
const { buildIndividualGrants } = await import("../src/lib/lead-filter")

const violations: string[] = []

const [users, stateRoutes, adRoutes] = await Promise.all([
  db.user.findMany({ select: { id: true, name: true, role: true, claimLimit: true } }),
  db.stateRoute.findMany({ select: { state: true, userIds: true } }),
  db.adRoute.findMany({ where: { archived: false }, select: { adName: true, userIds: true, userStates: true } }),
])

for (const user of users) {
  if (user.role === "SUPER_ADMIN") continue

  const [list, count] = await Promise.all([
    getAvailableLeads(user.id, user.role),
    getAvailableLeadsCount(user.id, user.role),
  ])

  // Invariant 4: counter must equal the claimable list
  if (count !== list.length) {
    violations.push(`${user.name}: counter shows ${count} but the claimable list has ${list.length}`)
  }

  // Invariant 1: StateRoute members see only their states' leads, unless the lead's ad
  // is individually routed to them directly (e.g. a language-specific ad override).
  const myStates = new Set(stateRoutes.filter((r) => r.userIds.includes(user.id)).map((r) => r.state))
  if (myStates.size > 0) {
    const myGrants = buildIndividualGrants(adRoutes.filter((r) => r.userIds.includes(user.id)), user.id)
    for (const lead of list) {
      if (lead.adName && myGrants.has(lead.adName)) {
        const allowed = myGrants.get(lead.adName)!
        if (allowed.length === 0 || (lead.branch && allowed.includes(lead.branch))) continue
      }
      if (!lead.branch || !myStates.has(lead.branch)) {
        violations.push(
          `${user.name} (states: ${[...myStates].join(", ")}) can see lead ${lead.id} from "${lead.branch ?? "no state"}"`
        )
      }
    }
  }

  console.log(`${user.name.padEnd(24)} ${user.role.padEnd(12)} sees ${String(list.length).padStart(4)} available leads`)
}

// Invariant 5: nobody exceeds their daily claim limit (window resets midnight MYT,
// matching the claim endpoint)
const MYT_OFFSET = 8 * 60 * 60 * 1000
const nowInMYT = Date.now() + MYT_OFFSET
const startOfDayUTC = new Date(nowInMYT - (nowInMYT % (24 * 60 * 60 * 1000)) - MYT_OFFSET)
const recentClaims = await db.lead.groupBy({
  by: ["claimedById"],
  where: { claimedAt: { gte: startOfDayUTC }, claimedById: { not: null } },
  _count: { _all: true },
})
for (const row of recentClaims) {
  const u = users.find((x) => x.id === row.claimedById)
  if (u && row._count._all > u.claimLimit) {
    violations.push(`${u.name} claimed ${row._count._all} leads today (limit ${u.claimLimit})`)
  }
}

if (violations.length > 0) {
  console.error(`\n❌ ${violations.length} violation(s):`)
  for (const v of violations) console.error(` - ${v}`)
  process.exit(1)
}
console.log("\n✅ All routing invariants hold.")
process.exit(0)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
