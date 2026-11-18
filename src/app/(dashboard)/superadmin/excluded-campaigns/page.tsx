import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { getCampaignEntries } from "@/lib/excluded-campaigns"
import { isSuperAdmin } from "@/lib/roles"
import ExcludedCampaignsClient from "@/components/ExcludedCampaignsClient"
import { getViewAsRole } from "@/lib/viewas"

export default async function ExcludedCampaignsPage() {
  const session = await auth()
  const role = await getViewAsRole(session?.user.role)
  if (!isSuperAdmin(role)) redirect("/")

  const campaigns = await getCampaignEntries()

  return <ExcludedCampaignsClient campaigns={campaigns} />
}
