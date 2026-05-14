import { cookies } from "next/headers"

export const VIEW_AS_ROLES = ["ADMIN", "TEAM_LEADER", "SALESPERSON"] as const
export type ViewAsRole = (typeof VIEW_AS_ROLES)[number]

export async function getViewAsRole(actualRole: string | null | undefined): Promise<string> {
  if (actualRole !== "SUPER_ADMIN") return actualRole ?? "SALESPERSON"
  const store = await cookies()
  const viewAs = store.get("viewAs")?.value
  if (viewAs && (VIEW_AS_ROLES as readonly string[]).includes(viewAs)) return viewAs
  return actualRole
}

export async function getCurrentViewAs(): Promise<string | null> {
  const store = await cookies()
  const viewAs = store.get("viewAs")?.value
  if (viewAs && (VIEW_AS_ROLES as readonly string[]).includes(viewAs)) return viewAs
  return null
}
