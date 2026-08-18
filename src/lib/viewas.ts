import { cookies } from "next/headers"
import { db } from "@/lib/db"

export type ViewAsUser = { id: string; name: string; role: string }

async function resolveViewAsUser(): Promise<ViewAsUser | null> {
  const store = await cookies()
  const id = store.get("viewAsUserId")?.value
  if (!id) return null
  const user = await db.user.findUnique({ where: { id }, select: { id: true, name: true, role: true, disabled: true } })
  if (!user || user.disabled || user.role === "SUPER_ADMIN") return null
  return { id: user.id, name: user.name, role: user.role }
}

// Role to gate/render by — the previewed user's role when actualRole is SUPER_ADMIN and a
// preview is active, else the real role. Cheap: doesn't require the caller to have a user id.
export async function getViewAsRole(actualRole: string | null | undefined): Promise<string> {
  if (actualRole !== "SUPER_ADMIN") return actualRole ?? "SALESPERSON"
  const viewAsUser = await resolveViewAsUser()
  return viewAsUser?.role ?? actualRole
}

// Full previewed user (id/name/role), or null if not previewing. Use this wherever "my
// leads" / "my team" data needs to be scoped to the previewed person rather than the real
// super admin, who typically has no team or leads of their own to show.
export async function getViewAsUser(actualRole: string | null | undefined): Promise<ViewAsUser | null> {
  if (actualRole !== "SUPER_ADMIN") return null
  return resolveViewAsUser()
}
