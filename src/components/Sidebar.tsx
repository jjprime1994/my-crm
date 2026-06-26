"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useEffect, useState } from "react"
import { signOut } from "next-auth/react"
import { isAdmin, isSuperAdmin, isManagerLevel } from "@/lib/roles"
import ViewAsSelector from "@/components/ViewAsSelector"
import { PATCH_NOTES, compareVersions } from "@/lib/patch-notes"
import ThemeToggle from "@/components/ThemeToggle"

interface Props {
  user: { name?: string | null; email?: string | null; role?: string | null }
  isSuperAdmin: boolean
  viewingAs: string | null
  counts: { followUps: number; availableLeads: number }
  onClose?: () => void
}

function Badge({ n }: { n: number }) {
  if (n === 0) return null
  return (
    <span className="ml-auto text-[10px] font-bold bg-blue-500 text-white px-1.5 py-0.5 rounded-full min-w-[18px] text-center leading-none">
      {n > 99 ? "99+" : n}
    </span>
  )
}

function initials(name?: string | null) {
  if (!name) return "?"
  const parts = name.trim().split(" ")
  return (parts[0][0] + (parts[1]?.[0] ?? "")).toUpperCase()
}

const Icons = {
  dashboard: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" />
    </svg>
  ),
  leads: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  ),
  bell: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  ),
  inbox: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="22 12 16 12 14 15 10 15 8 12 2 12" />
      <path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
    </svg>
  ),
  assign: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="17 1 21 5 17 9" /><path d="M3 11V9a4 4 0 0 1 4-4h14" />
      <polyline points="7 23 3 19 7 15" /><path d="M21 13v2a4 4 0 0 1-4 4H3" />
    </svg>
  ),
  team: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  ),
  settings: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
    </svg>
  ),
  faq: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/>
    </svg>
  ),
  whatsNew: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
    </svg>
  ),
  feedback: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
    </svg>
  ),
  logout: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  ),
  overview: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>
    </svg>
  ),
  export: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
    </svg>
  ),
  routing: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="6" cy="6" r="3"/><circle cx="18" cy="18" r="3"/><path d="M6 9v3a6 6 0 0 0 6 6h3"/><path d="M13 6h3a3 3 0 0 1 3 3v3"/>
    </svg>
  ),
}

export default function Sidebar({ user, onClose, isSuperAdmin: actualSuperAdmin, viewingAs, counts }: Props) {
  const pathname = usePathname()
  const admin = isAdmin(user.role)
  const superAdmin = isSuperAdmin(user.role)
  const managerLevel = isManagerLevel(user.role)

  const [unreadPatch, setUnreadPatch] = useState(0)
  useEffect(() => {
    if (pathname === "/patch-notes" && PATCH_NOTES.length > 0) {
      localStorage.setItem("lastSeenPatchVersion", PATCH_NOTES[0].version)
      setUnreadPatch(0)
      return
    }
    const lastSeen = localStorage.getItem("lastSeenPatchVersion")
    setUnreadPatch(PATCH_NOTES.filter((n) => !lastSeen || compareVersions(n.version, lastSeen) > 0).length)
  }, [pathname])

  const nav = [
    { href: "/", label: "Dashboard", icon: Icons.dashboard, count: 0 },
    { href: "/leads", label: "Leads", icon: Icons.leads, count: 0 },
    { href: "/follow-ups", label: "Follow-ups", icon: Icons.bell, count: counts.followUps },
    { href: "/available-leads", label: "Available Leads", icon: Icons.inbox, count: counts.availableLeads },
    ...(managerLevel ? [{ href: "/admin/users", label: "Manage Team", icon: Icons.team, count: 0 }] : []),
    ...(managerLevel && !superAdmin ? [
      { href: "/admin/overview", label: "Team Overview", icon: Icons.overview, count: 0 },
    ] : []),
  ]

  const superAdminNav = superAdmin
    ? [
        { href: "/admin/assign", label: "Assign Leads", icon: Icons.assign },
        { href: "/superadmin/overview", label: "Overview", icon: Icons.overview },
        { href: "/superadmin/export", label: "Export Leads", icon: Icons.export },
        { href: "/superadmin/routing", label: "Ad Routing", icon: Icons.routing },
      ]
    : []

  return (
    <aside className="w-60 flex flex-col bg-slate-900 h-full shrink-0">
      {/* Brand */}
      <div className="px-5 py-5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <img
            src="https://sfa.nuvending.my/assets/images/logo/nuvending.png"
            alt="Nu Vending"
            className="h-8 w-auto object-contain"
          />
          <span className="font-bold text-white text-base tracking-tight">Nu Vending</span>
        </div>
        {onClose && (
          <button onClick={onClose} className="lg:hidden text-slate-400 hover:text-white transition p-1">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-2 space-y-0.5 overflow-y-auto">
        {nav.map(({ href, label, icon, count }) => {
          const active = href === "/" ? pathname === "/" : pathname.startsWith(href)
          return (
            <Link
              key={href}
              href={href}
              onClick={onClose}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                active
                  ? "bg-blue-600 text-white shadow-sm"
                  : "text-slate-400 hover:bg-slate-800 hover:text-white"
              }`}
            >
              <span className={active ? "text-white" : "text-slate-500"}>{icon}</span>
              {label}
              <Badge n={count} />
            </Link>
          )
        })}

        {superAdminNav.length > 0 && (
          <>
            <div className="pt-3 pb-1 px-3">
              <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest">Super Admin</p>
            </div>
            {superAdminNav.map(({ href, label, icon }) => {
              const active = pathname.startsWith(href)
              return (
                <Link
                  key={href}
                  href={href}
                  onClick={onClose}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                    active
                      ? "bg-violet-600 text-white shadow-sm"
                      : "text-slate-400 hover:bg-slate-800 hover:text-white"
                  }`}
                >
                  <span className={active ? "text-white" : "text-slate-500"}>{icon}</span>
                  {label}
                </Link>
              )
            })}
          </>
        )}
      </nav>

      {/* View As selector — super admins only */}
      {actualSuperAdmin && <ViewAsSelector currentViewAs={viewingAs} />}

      {/* Settings + FAQ */}
      <div className="px-3 pb-1 border-t border-slate-800 pt-2">
        <ThemeToggle />
        {[
          { href: "/patch-notes", label: "What's New", icon: Icons.whatsNew, badge: unreadPatch },
          { href: "/feedback", label: "Feedback", icon: Icons.feedback, badge: 0 },
          { href: "/faq", label: "Help & FAQ", icon: Icons.faq, badge: 0 },
          { href: "/settings", label: "Settings", icon: Icons.settings, badge: 0 },
        ].map(({ href, label, icon, badge }) => {
          const active = pathname === href
          return (
            <Link
              key={href}
              href={href}
              onClick={onClose}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                active ? "bg-blue-600 text-white shadow-sm" : "text-slate-400 hover:bg-slate-800 hover:text-white"
              }`}
            >
              <span className={active ? "text-white" : "text-slate-500"}>{icon}</span>
              {label}
              {badge > 0 && <Badge n={badge} />}
            </Link>
          )
        })}
      </div>

      {/* Copyright */}
      <div className="px-5 pb-2">
        <a
          href="/disclaimer"
          target="_blank"
          className="text-[10px] text-slate-600 hover:text-slate-400 transition leading-tight block"
        >
          © {new Date().getFullYear()} Tan Jia Jin. All rights reserved.<br />
          Proprietary software — unauthorised use prohibited.
        </a>
      </div>

      {/* User */}
      <div className="px-3 py-4 border-t border-slate-800">
        <div className="flex items-center gap-3 px-3 py-2 rounded-lg">
          <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center shrink-0 text-xs font-bold text-white">
            {initials(user.name)}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white truncate">{user.name}</p>
            <p className="text-xs text-slate-400 truncate">
              {user.role === "SUPER_ADMIN" ? "Super Admin" : user.role === "ADMIN" ? "Manager" : user.role === "TEAM_LEADER" ? "Team Leader" : "Salesperson"}
            </p>
          </div>
        </div>
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="flex items-center gap-2 w-full px-3 py-2 mt-1 text-sm text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition"
        >
          {Icons.logout}
          Sign out
        </button>
      </div>
    </aside>
  )
}
