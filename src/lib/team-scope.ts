import { db } from "@/lib/db"

export type ScopedUser = {
  id: string
  name: string
  role: string
  managerId: string | null
  disabled: boolean
  /** The ADMIN whose team this person belongs to (an ADMIN heads their own team); null = no team. */
  teamId: string | null
  /** teamName of that ADMIN, falling back to their name — same label Ad Routing uses. */
  teamLabel: string | null
}

// Prisma `where` for the users an actor can see and edit commission / daily-activity entries for:
//   SUPER_ADMIN → everyone
//   ADMIN       → self, their direct reports, and their team leaders' reports
//   TEAM_LEADER → self and direct reports
//   SALESPERSON → self only
// Mirrors the Manage Team scoping in admin/users/page.tsx.
export function teamScopeWhere(actorId: string, role: string) {
  if (role === "SUPER_ADMIN") return {}
  if (role === "ADMIN") {
    return { OR: [{ id: actorId }, { managerId: actorId }, { manager: { managerId: actorId } }] }
  }
  if (role === "TEAM_LEADER") return { OR: [{ id: actorId }, { managerId: actorId }] }
  return { id: actorId }
}

const userSelect = {
  id: true, name: true, role: true, managerId: true, disabled: true, teamName: true,
  manager: {
    select: {
      id: true, name: true, role: true, teamName: true,
      manager: { select: { id: true, name: true, role: true, teamName: true } },
    },
  },
} as const

export async function getScopedUsers(actorId: string, role: string): Promise<ScopedUser[]> {
  const users = await db.user.findMany({ where: teamScopeWhere(actorId, role), select: userSelect, orderBy: { name: "asc" } })
  return users.map((u) => {
    // Team head = first ADMIN walking up self → manager → manager's manager
    const head = [u, u.manager, u.manager?.manager].find((x) => x && x.role === "ADMIN") ?? null
    return {
      id: u.id, name: u.name, role: u.role, managerId: u.managerId, disabled: u.disabled,
      teamId: head?.id ?? null,
      teamLabel: head ? head.teamName || head.name : null,
    }
  })
}

export async function canManageUser(actorId: string, role: string, targetUserId: string): Promise<boolean> {
  if (actorId === targetUserId) return true
  if (role === "SUPER_ADMIN") return true
  const hit = await db.user.findFirst({
    where: { AND: [{ id: targetUserId }, teamScopeWhere(actorId, role)] },
    select: { id: true },
  })
  return !!hit
}
