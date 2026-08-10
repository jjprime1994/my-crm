export function initials(name: string) {
  const p = name.trim().split(" ")
  return (p[0][0] + (p[1]?.[0] ?? "")).toUpperCase()
}

export function roleBadge(role: string) {
  return role === "SUPER_ADMIN" ? "Super Admin" : role === "ADMIN" ? "Manager" : "Team Leader"
}
