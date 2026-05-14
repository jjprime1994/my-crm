import { auth } from "@/auth"
import { db } from "@/lib/db"
import { isManagerLevel } from "@/lib/roles"
import FeedbackClient from "@/components/FeedbackClient"
import { getViewAsRole } from "@/lib/viewas"

export default async function FeedbackPage() {
  const session = await auth()
  const role = await getViewAsRole(session?.user.role)
  const isAdmin = isManagerLevel(role)

  const suggestions = await db.suggestion.findMany({
    where: isAdmin ? undefined : { userId: session!.user.id },
    include: { user: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
  })

  return (
    <FeedbackClient
      initialSuggestions={suggestions}
      isAdmin={isAdmin}
      currentUserId={session!.user.id}
    />
  )
}
