import { auth } from "@/auth"
import { db } from "@/lib/db"
import { notFound } from "next/navigation"
import LeadDetailClient from "@/components/LeadDetailClient"

export default async function LeadDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  const isAdmin = session?.user.role === "ADMIN"
  const { id } = await params

  const [lead, salespeople] = await Promise.all([
    db.lead.findUnique({
      where: { id },
      include: {
        assignedTo: { select: { id: true, name: true, email: true } },
        notes: {
          include: { author: { select: { id: true, name: true } } },
          orderBy: { createdAt: "desc" },
        },
      },
    }),
    isAdmin
      ? db.user.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } })
      : Promise.resolve([]),
  ])

  if (!lead) notFound()

  // Salespeople can only view leads assigned to them
  if (!isAdmin && lead.assignedToId !== session?.user.id) notFound()

  return (
    <LeadDetailClient
      lead={lead}
      salespeople={salespeople}
      currentUser={{ id: session!.user.id, role: session!.user.role }}
    />
  )
}
