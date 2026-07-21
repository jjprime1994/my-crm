import { db } from "@/lib/db"

/**
 * Auto-assign via StateRoute round-robin — only members of a StateRoute are eligible.
 * The index is incremented atomically so concurrent webhooks get unique starting slots.
 * Returns null if there's no branch, no matching StateRoute, or everyone in the route is at capacity.
 */
export async function assignLeadByBranch(branch: string | null): Promise<string | null> {
  if (!branch) return null

  const rows = await db.$queryRaw<{ userIds: string[]; slotIdx: number }[]>`
    UPDATE "StateRoute"
    SET "lastAssignedIndex" = "lastAssignedIndex" + 1
    WHERE state = ${branch} AND array_length("userIds", 1) > 0
    RETURNING "userIds",
      (("lastAssignedIndex" - 1) % array_length("userIds", 1))::int AS "slotIdx"
  `
  if (rows.length === 0) return null

  const { userIds, slotIdx } = rows[0]
  const [users, activeCounts] = await Promise.all([
    db.user.findMany({ where: { id: { in: userIds } }, select: { id: true, claimLimit: true, disabled: true } }),
    db.lead.groupBy({
      by: ["assignedToId"],
      where: { assignedToId: { in: userIds }, status: { notIn: ["CLOSED_WON", "CLOSED_LOST"] } },
      _count: { id: true },
    }),
  ])
  const limitMap = Object.fromEntries(users.map((u) => [u.id, u.claimLimit]))
  const disabledSet = new Set(users.filter((u) => u.disabled).map((u) => u.id))
  const countMap = Object.fromEntries(activeCounts.map((r) => [r.assignedToId!, r._count.id]))

  for (let i = 0; i < userIds.length; i++) {
    const uid = userIds[(slotIdx + i) % userIds.length]
    if (disabledSet.has(uid)) continue
    if ((countMap[uid] ?? 0) < (limitMap[uid] ?? 5)) {
      return uid
    }
  }
  return null
}
