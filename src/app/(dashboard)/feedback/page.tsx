import { auth } from "@/auth"
import { db } from "@/lib/db"
import { isManagerLevel } from "@/lib/roles"
import FeedbackClient from "@/components/FeedbackClient"
import { getViewAsRole, getViewAsUser } from "@/lib/viewas"

export default async function FeedbackPage() {
  const session = await auth()
  const [role, viewAsUser] = await Promise.all([
    getViewAsRole(session?.user.role),
    getViewAsUser(session?.user.role),
  ])
  const effectiveUserId = viewAsUser?.id ?? session!.user.id
  const isAdmin = isManagerLevel(role)

  const suggestions = await db.suggestion.findMany({
    where: isAdmin ? undefined : { userId: effectiveUserId },
    include: { user: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
  })

  return (
    <FeedbackClient
      initialSuggestions={suggestions}
      isAdmin={isAdmin}
      currentUserId={effectiveUserId}
    />
  )
}
