"use server"

import { cookies } from "next/headers"
import { auth } from "@/auth"
import { revalidatePath } from "next/cache"
import { VIEW_AS_ROLES, type ViewAsRole } from "@/lib/viewas"

export async function setViewAs(formData: FormData) {
  const session = await auth()
  if (session?.user.role !== "SUPER_ADMIN") return

  const role = formData.get("role")?.toString()
  const store = await cookies()

  if (role && (VIEW_AS_ROLES as readonly string[]).includes(role)) {
    store.set("viewAs", role as ViewAsRole, { httpOnly: true, sameSite: "lax", path: "/" })
  } else {
    store.delete("viewAs")
  }

  revalidatePath("/", "layout")
}
