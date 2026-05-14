import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { db } from "@/lib/db"
import { isSuperAdmin } from "@/lib/roles"
import ExportClient from "@/components/ExportClient"
import { getViewAsRole } from "@/lib/viewas"

export default async function ExportPage() {
  const session = await auth()
  const role = await getViewAsRole(session?.user.role)
  if (!isSuperAdmin(role)) redirect("/")

  const sources = await db.lead.findMany({
    where: { adName: { not: null } },
    select: { adName: true },
    distinct: ["adName"],
    orderBy: { adName: "asc" },
  })

  const totalByStatus = await db.lead.groupBy({ by: ["status"], _count: true })
  const counts = Object.fromEntries(totalByStatus.map((s) => [s.status, s._count]))

  return (
    <ExportClient
      sources={sources.map((s) => s.adName!)}
      counts={counts}
    />
  )
}
