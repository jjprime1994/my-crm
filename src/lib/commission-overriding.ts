import { db } from "@/lib/db"
import { getCommissionBlockedIds } from "@/lib/app-settings"
import type { CommissionClaim } from "@/generated/prisma/client"
import { OVERRIDING_FOR } from "./commission"

// Owner rule (23 Nov 2026): when someone keys in an MA "Sales Commission" (or LA "Location
// Commission") row, the same row is copied as "Sales Overriding" (or "Location Overriding") to
// their DIRECT leader (managerId) — one level only, not the leader's leader — with Amount Claim
// left blank for the leader to fill in.
// The copy is linked by sourceClaimId: editing the source re-syncs the copy's details (the
// leader's amount is kept), deleting the source deletes the copy (FK cascade), and changing the
// source away from "Sales Commission" removes the copy.

const COPIED_FIELDS = [
  "month", "branch", "customerName", "packageType", "machineType", "poNo", "poDate", "sellingPrice",
  "totalCollection", "lastPaymentDate", "machineCount", "kpi", "incentive", "paymentMadePct",
  "machinePoNo", "locationPoNo", "locationName",
] as const

export function needsOverridingCopy(c: Pick<CommissionClaim, "kind" | "commissionType" | "sourceClaimId">) {
  // A copy never spawns another copy, even if its type is edited to "Sales Commission"
  return c.commissionType === OVERRIDING_FOR[c.kind].from && !c.sourceClaimId
}

function copiedDetails(source: CommissionClaim) {
  return Object.fromEntries(COPIED_FIELDS.map((k) => [k, source[k]]))
}

export type OverridingSync = { copy: CommissionClaim | null; removedId: string | null }

/**
 * Brings the leader's overriding copy in line with `source` after a create or edit.
 * `wasSalesCommission`: whether the source qualified before this edit (null for a new claim) —
 * a copy the leader deliberately deleted is not recreated by later edits of the same source.
 */
export async function syncOverridingCopy(
  source: CommissionClaim,
  wasSalesCommission: boolean | null,
  actorId: string,
): Promise<OverridingSync> {
  const existing = await db.commissionClaim.findUnique({ where: { sourceClaimId: source.id } })

  if (!needsOverridingCopy(source)) {
    if (!existing) return { copy: null, removedId: null }
    await db.commissionClaim.delete({ where: { id: existing.id } })
    return { copy: null, removedId: existing.id }
  }

  if (existing) {
    const copy = await db.commissionClaim.update({
      where: { id: existing.id },
      data: { ...copiedDetails(source), updatedById: actorId },
    })
    return { copy, removedId: null }
  }

  if (wasSalesCommission === true) return { copy: null, removedId: null } // leader removed it on purpose

  const owner = await db.user.findUnique({ where: { id: source.userId }, select: { managerId: true } })
  if (!owner?.managerId) return { copy: null, removedId: null }
  if ((await getCommissionBlockedIds()).includes(owner.managerId)) return { copy: null, removedId: null }

  const copy = await db.commissionClaim.create({
    data: {
      ...copiedDetails(source),
      kind: source.kind,
      userId: owner.managerId,
      customerName: source.customerName,
      month: source.month,
      commissionType: OVERRIDING_FOR[source.kind].to,
      amountClaim: null,
      sourceClaimId: source.id,
      createdById: actorId,
      updatedById: actorId,
    },
  })
  return { copy, removedId: null }
}
