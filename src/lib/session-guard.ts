import { db } from "@/lib/db"

// A disabled user's JWT can still be valid (no live session store to invalidate
// on disable), so API routes touching leads must re-check on every request.
export async function isUserDisabled(userId: string): Promise<boolean> {
  const user = await db.user.findUnique({ where: { id: userId }, select: { disabled: true } })
  return user?.disabled ?? true
}
