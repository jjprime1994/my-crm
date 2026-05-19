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

  const [sources, branches, managers, totalByStatus] = await Promise.all([
    db.lead.findMany({
      where: { adName: { not: null } },
      select: { adName: true },
      distinct: ["adName"],
      orderBy: { adName: "asc" },
    }),
    db.lead.findMany({
      where: { branch: { not: null } },
      select: { branch: true },
      distinct: ["branch"],
      orderBy: { branch: "asc" },
    }).catch(() => []),
    db.user.findMany({
      where: { role: { in: ["ADMIN", "SUPER_ADMIN"] } },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    db.lead.groupBy({ by: ["status"], _count: true }),
  ])

  const counts = Object.fromEntries(totalByStatus.map((s) => [s.status, s._count]))

  return (
    <ExportClient
      sources={sources.map((s) => s.adName!)}
      branches={branches.map((b) => b.branch!)}
      managers={managers}
      counts={counts}
    />
  )
}
