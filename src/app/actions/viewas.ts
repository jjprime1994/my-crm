"use server"

import { cookies } from "next/headers"
import { auth } from "@/auth"
import { db } from "@/lib/db"
import { revalidatePath } from "next/cache"

export async function setViewAsUser(formData: FormData) {
  const session = await auth()
  if (session?.user.role !== "SUPER_ADMIN") return

  const userId = formData.get("userId")?.toString()
  const store = await cookies()

  if (userId) {
    const target = await db.user.findUnique({ where: { id: userId }, select: { role: true, disabled: true } })
    if (target && !target.disabled && target.role !== "SUPER_ADMIN") {
      store.set("viewAsUserId", userId, { httpOnly: true, sameSite: "lax", path: "/" })
    } else {
      store.delete("viewAsUserId")
    }
  } else {
    store.delete("viewAsUserId")
  }

  revalidatePath("/", "layout")
}
