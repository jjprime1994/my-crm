import { db } from "@/lib/db"

// Johnny Liong (SUPER_ADMIN) owns the default team
const DEFAULT_TEAM_OWNER_ID = "cmp2ckqkr000004l27jkpfzmq"

/**
 * Returns the ID of the best available salesperson in Johnny's team —
 * whoever has the fewest active leads and is still under their claim limit.
 * Returns null if everyone is at capacity.
 */
export async function assignToDefaultTeam(): Promise<string | null> {
  // Direct reports (team leaders + any direct salespeople)
  const directReports = await db.user.findMany({
    where: { managerId: DEFAULT_TEAM_OWNER_ID, role: { in: ["TEAM_LEADER", "SALESPERSON"] }, disabled: false },
    select: { id: true, role: true },
  })

  const leaderIds = directReports.filter((u) => u.role === "TEAM_LEADER").map((u) => u.id)
  const directSalespersonIds = directReports.filter((u) => u.role === "SALESPERSON").map((u) => u.id)

  // Salespeople under team leaders
  const subSalespeople = leaderIds.length > 0
    ? await db.user.findMany({
        where: { managerId: { in: leaderIds }, role: "SALESPERSON", disabled: false },
        select: { id: true },
      })
    : []

  const allIds = [...directSalespersonIds, ...subSalespeople.map((u) => u.id)]
  if (allIds.length === 0) return null

  const [users, activeCounts] = await Promise.all([
    db.user.findMany({ where: { id: { in: allIds } }, select: { id: true, claimLimit: true } }),
    db.lead.groupBy({
      by: ["assignedToId"],
      where: { assignedToId: { in: allIds }, status: { notIn: ["CLOSED_WON", "CLOSED_LOST"] } },
      _count: { id: true },
    }),
  ])

  const limitMap = Object.fromEntries(users.map((u) => [u.id, u.claimLimit]))
  const countMap = Object.fromEntries(activeCounts.map((r) => [r.assignedToId!, r._count.id]))

  let chosen: string | null = null
  let minCount = Infinity
  for (const uid of allIds) {
    const count = countMap[uid] ?? 0
    const limit = limitMap[uid] ?? 5
    if (count < limit && count < minCount) {
      chosen = uid
      minCount = count
    }
  }
  return chosen
}
