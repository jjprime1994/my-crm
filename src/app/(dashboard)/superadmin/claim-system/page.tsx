import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { isSuperAdmin } from "@/lib/roles"
import { getViewAsRole } from "@/lib/viewas"
import { isClaimingPaused } from "@/lib/app-settings"
import ClaimSystemClient from "@/components/ClaimSystemClient"

export default async function ClaimSystemPage() {
  const session = await auth()
  const role = await getViewAsRole(session?.user.role)
  if (!isSuperAdmin(role)) redirect("/")
  return <ClaimSystemClient paused={await isClaimingPaused()} />
}
