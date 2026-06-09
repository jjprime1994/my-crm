import { db } from "@/lib/db"

type AdminInfo = { id: string; coveredStates: string[]; isDefaultTeam: boolean } | null

async function getEffectiveAdmin(userId: string, role: string): Promise<AdminInfo> {
  if (role === "ADMIN" || role === "SUPER_ADMIN") {
    return db.user.findUnique({
      where: { id: userId },
      select: { id: true, coveredStates: true, isDefaultTeam: true },
    })
  }
  const me = await db.user.findUnique({
    where: { id: userId },
    select: {
      manager: {
        select: {
          id: true, role: true, coveredStates: true, isDefaultTeam: true,
          manager: { select: { id: true, role: true, coveredStates: true, isDefaultTeam: true } },
        },
      },
    },
  })
  const mgr = me?.manager
  if (!mgr) return null
  if (mgr.role === "ADMIN" || mgr.role === "SUPER_ADMIN") return { id: mgr.id, coveredStates: mgr.coveredStates, isDefaultTeam: mgr.isDefaultTeam }
  if (mgr.manager && (mgr.manager.role === "ADMIN" || mgr.manager.role === "SUPER_ADMIN"))
    return { id: mgr.manager.id, coveredStates: mgr.manager.coveredStates, isDefaultTeam: mgr.manager.isDefaultTeam }
  return null
}

type Lead = {
  adName?: string | null
  branch?: string | null
}

function filterLeads<T extends Lead>(
  allLeads: T[],
  effectiveAdmin: AdminInfo,
  routeIndex: Record<string, string[]>,
  routedAdNames: Set<string>,
  managerStates: Record<string, string[]>,
): T[] {
  return allLeads.filter((lead) => {
    if (!effectiveAdmin) return false

    const adName = lead.adName ?? null
    const branch = lead.branch ?? null
    const adIsRouted = adName ? routedAdNames.has(adName) : false

    if (!adIsRouted) {
      return effectiveAdmin.isDefaultTeam
    }

    const assignedTeams = adName ? (routeIndex[adName] ?? []) : []
    const teamIsAssigned = assignedTeams.includes(effectiveAdmin.id)

    if (!teamIsAssigned) {
      if (effectiveAdmin.isDefaultTeam) {
        const leadCoveredByAssignedTeam = assignedTeams.some((teamId) => {
          const states = managerStates[teamId] ?? []
          if (states.length === 0) return true
          return branch ? states.includes(branch) : true
        })
        return !leadCoveredByAssignedTeam
      }
      return false
    }

    if (!branch) return true
    if (effectiveAdmin.coveredStates.length === 0) return true
    return effectiveAdmin.coveredStates.includes(branch)
  })
}

export async function getAvailableLeads(userId: string, role: string) {
  const [allLeads, allRoutes, allManagers, effectiveAdmin] = await Promise.all([
    db.lead.findMany({
      where: { assignedToId: null, status: { notIn: ["CLOSED_WON", "CLOSED_LOST"] }, isDuplicate: false },
      orderBy: { createdAt: "desc" },
    }),
    db.adRoute.findMany().catch(() => []),
    db.user.findMany({ where: { role: { in: ["ADMIN", "SUPER_ADMIN"] } }, select: { id: true, coveredStates: true } }).catch(() => []),
    getEffectiveAdmin(userId, role).catch(() => null),
  ])

  const routeIndex = Object.fromEntries(allRoutes.map((r) => [r.adName, r.teamIds]))
  const routedAdNames = new Set(allRoutes.map((r) => r.adName))
  const managerStates = Object.fromEntries(allManagers.map((m) => [m.id, m.coveredStates]))

  return filterLeads(allLeads, effectiveAdmin, routeIndex, routedAdNames, managerStates)
}

export async function getAvailableLeadsCount(userId: string, role: string): Promise<number> {
  if (role === "SUPER_ADMIN") {
    return db.lead.count({ where: { assignedToId: null, isDuplicate: false } }).catch(() => 0)
  }
  if (role === "ADMIN") return 0

  try {
    const leads = await getAvailableLeads(userId, role)
    return leads.length
  } catch {
    return 0
  }
}
