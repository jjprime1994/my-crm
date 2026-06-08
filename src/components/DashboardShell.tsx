"use client"

import { useState } from "react"
import Sidebar from "@/components/Sidebar"
import ViewAsBanner from "@/components/ViewAsBanner"
import NotificationBell from "@/components/NotificationBell"

interface Props {
  user: { name?: string | null; email?: string | null; role?: string | null }
  viewingAs: string | null
  isSuperAdmin: boolean
  counts: { followUps: number; availableLeads: number }
  children: React.ReactNode
}

export default function DashboardShell({ user, viewingAs, isSuperAdmin, counts, children }: Props) {
  const [open, setOpen] = useState(false)

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Mobile overlay backdrop */}
      {open && (
        <div
          className="fixed inset-0 bg-black/50 z-20 lg:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Sidebar — drawer on mobile, static on desktop */}
      <div className={`fixed inset-y-0 left-0 z-30 transition-transform duration-200 lg:static lg:translate-x-0 lg:z-auto ${
        open ? "translate-x-0" : "-translate-x-full"
      }`}>
        <Sidebar user={user} onClose={() => setOpen(false)} isSuperAdmin={isSuperAdmin} viewingAs={viewingAs} counts={counts} />
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* View-as banner */}
        {viewingAs && <ViewAsBanner viewAs={viewingAs} />}

        {/* Top bar */}
        <header className="flex items-center gap-3 bg-white border-b border-gray-100 px-4 py-2.5 shrink-0">
          {/* Hamburger + logo — mobile only */}
          <button
            onClick={() => setOpen(true)}
            className="lg:hidden text-gray-500 hover:text-gray-700 transition p-1"
            aria-label="Open menu"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>
            </svg>
          </button>
          <img
            src="https://sfa.nuvending.my/assets/images/logo/nuvending.png"
            alt="Nu Vending"
            className="lg:hidden h-7 w-auto object-contain"
          />
          <span className="lg:hidden text-gray-900 font-bold text-sm tracking-tight">Nu Vending</span>
          <div className="flex-1" />
          <NotificationBell />
        </header>

        <main className="flex-1 overflow-y-auto bg-gray-50 px-4 py-5 lg:px-8 lg:py-7">
          {children}
        </main>
      </div>
    </div>
  )
}
