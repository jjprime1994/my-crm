import { db } from "@/lib/db"
import { getAvailableLeads, getAvailableLeadsCount } from "@/lib/available-leads"

// Runs the CLAUDE.md "Lead Routing Rules" invariants against the live database
// using the real production code paths. Returns human-readable violations
// (empty array = all invariants hold). Mirrors scripts/check-routing.ts.
export async function checkRoutingInvariants(): Promise<string[]> {
  const violations: string[] = []

  const [users, stateRoutes] = await Promise.all([
    db.user.findMany({ select: { id: true, name: true, role: true, claimLimit: true } }),
    db.stateRoute.findMany({ select: { state: true, userIds: true } }),
  ])

  const checkable = users.filter((u) => u.role !== "SUPER_ADMIN")

  // Small batches: enough parallelism to finish fast, without hammering the DB pool.
  const BATCH = 8
  for (let i = 0; i < checkable.length; i += BATCH) {
    await Promise.all(
      checkable.slice(i, i + BATCH).map(async (user) => {
        const [list, count] = await Promise.all([
          getAvailableLeads(user.id, user.role),
          getAvailableLeadsCount(user.id, user.role),
        ])

        // Invariant: counter must equal the claimable list
        if (count !== list.length) {
          violations.push(`${user.name}: counter shows ${count} but the claimable list has ${list.length}`)
        }

        // Invariant: StateRoute members see only their states' leads
        const myStates = new Set(stateRoutes.filter((r) => r.userIds.includes(user.id)).map((r) => r.state))
        if (myStates.size > 0) {
          for (const lead of list) {
            if (!lead.branch || !myStates.has(lead.branch)) {
              violations.push(
                `${user.name} (states: ${[...myStates].join(", ")}) can see lead ${lead.id} from "${lead.branch ?? "no state"}"`
              )
            }
          }
        }
      })
    )
  }

  // Invariant: nobody exceeds claimLimit claims in the current 15-minute window
  const since = new Date(Date.now() - 15 * 60 * 1000)
  const recentClaims = await db.lead.groupBy({
    by: ["claimedById"],
    where: { claimedAt: { gte: since }, claimedById: { not: null } },
    _count: { _all: true },
  })
  for (const row of recentClaims) {
    const u = users.find((x) => x.id === row.claimedById)
    if (u && row._count._all > u.claimLimit) {
      violations.push(`${u.name} claimed ${row._count._all} leads in the last 15 min (limit ${u.claimLimit})`)
    }
  }

  return violations
}
