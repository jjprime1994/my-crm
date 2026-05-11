export const isAdmin = (role?: string | null) =>
  role === "ADMIN" || role === "SUPER_ADMIN"

export const isSuperAdmin = (role?: string | null) =>
  role === "SUPER_ADMIN"
