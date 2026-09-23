import { db } from "@/lib/db"
import { filterLeads } from "@/lib/lead-filter"
import { getEffectiveAdmin } from "@/lib/available-leads"

// Appointment slots route by branch only (no ad-routing) — reuses filterLeads' "no adName"
// branch-matching leg by always passing adName: null, so the same StateRoute/AdRoute-team
// coveredStates/default-team semantics leads already use apply here for free.

async function loadRoutingContext() {
  const allManagers = await db.user
    .findMany({ where: { role: { in: ["ADMIN", "SUPER_ADMIN"] } }, select: { id: true, coveredStates: true, isDefaultTeam: true } })
    .catch(() => [])
  return {
    managerStates: Object.fromEntries(allManagers.map((m) => [m.id, m.coveredStates])),
    hasDefaultTeam: allManagers.some((m) => m.isDefaultTeam),
  }
}

const slotSelect = {
  id: true, branch: true, startAt: true, endAt: true, status: true, claimedById: true, claimedAt: true,
  lead: { select: { id: true, firstName: true, lastName: true, phone: true, email: true } },
} as const

export async function getAvailableAppointments(userId: string, role: string) {
  if (role === "SUPER_ADMIN") {
    return db.appointmentSlot.findMany({ where: { status: "BOOKED" }, select: slotSelect, orderBy: { startAt: "asc" } })
  }

  const stateRoutes = await db.stateRoute.findMany({ where: { userIds: { has: userId } }, select: { state: true } }).catch(() => [])
  if (stateRoutes.length > 0) {
    const states = stateRoutes.map((r) => r.state)
    return db.appointmentSlot.findMany({
      where: { status: "BOOKED", branch: { in: states } },
      select: slotSelect,
      orderBy: { startAt: "asc" },
    })
  }

  const [{ managerStates, hasDefaultTeam }, effectiveAdmin] = await Promise.all([
    loadRoutingContext(),
    getEffectiveAdmin(userId, role).catch(() => null),
  ])

  const allSlots = await db.appointmentSlot.findMany({ where: { status: "BOOKED" }, select: slotSelect, orderBy: { startAt: "asc" } })
  const leanRows = allSlots.map((s) => ({ id: s.id, adName: null as string | null, branch: s.branch as string | null }))
  const allowed = new Set(filterLeads(leanRows, effectiveAdmin, {}, new Set(), managerStates, hasDefaultTeam).map((r) => r.id))
  return allSlots.filter((s) => allowed.has(s.id))
}

export async function isAppointmentClaimableBy(userId: string, role: string, slot: { branch: string }): Promise<boolean> {
  if (role === "SUPER_ADMIN") return true

  const stateRoutes = await db.stateRoute.findMany({ where: { userIds: { has: userId } }, select: { state: true } }).catch(() => [])
  if (stateRoutes.length > 0) return stateRoutes.some((r) => r.state === slot.branch)

  const [{ managerStates, hasDefaultTeam }, effectiveAdmin] = await Promise.all([
    loadRoutingContext(),
    getEffectiveAdmin(userId, role).catch(() => null),
  ])
  return filterLeads([{ adName: null as string | null, branch: slot.branch as string | null }], effectiveAdmin, {}, new Set(), managerStates, hasDefaultTeam).length === 1
}

export async function getAvailableAppointmentsCount(userId: string, role: string): Promise<number> {
  if (role === "SUPER_ADMIN") {
    return db.appointmentSlot.count({ where: { status: "BOOKED" } }).catch(() => 0)
  }

  try {
    const stateRoutes = await db.stateRoute.findMany({ where: { userIds: { has: userId } }, select: { state: true } }).catch(() => [])
    if (stateRoutes.length > 0) {
      const states = stateRoutes.map((r) => r.state)
      return db.appointmentSlot.count({ where: { status: "BOOKED", branch: { in: states } } }).catch(() => 0)
    }

    const [{ managerStates, hasDefaultTeam }, effectiveAdmin] = await Promise.all([
      loadRoutingContext(),
      getEffectiveAdmin(userId, role).catch(() => null),
    ])
    const leanSlots = await db.appointmentSlot.findMany({ where: { status: "BOOKED" }, select: { id: true, branch: true } })
    const leanRows = leanSlots.map((s) => ({ id: s.id, adName: null as string | null, branch: s.branch as string | null }))
    return filterLeads(leanRows, effectiveAdmin, {}, new Set(), managerStates, hasDefaultTeam).length
  } catch {
    return 0
  }
}
