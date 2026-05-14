export const isAdmin = (role?: string | null) =>
  role === "ADMIN" || role === "SUPER_ADMIN"

export const isSuperAdmin = (role?: string | null) =>
  role === "SUPER_ADMIN"

export const isTeamLeader = (role?: string | null) =>
  role === "TEAM_LEADER"

export const isManagerLevel = (role?: string | null) =>
  role === "ADMIN" || role === "SUPER_ADMIN" || role === "TEAM_LEADER"
