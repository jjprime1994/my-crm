"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { signOut } from "next-auth/react"

interface Props {
  user: { name?: string | null; email?: string | null; role?: string }
}

const nav = [
  { href: "/", label: "Dashboard" },
  { href: "/leads", label: "Leads" },
]

export default function Sidebar({ user }: Props) {
  const pathname = usePathname()

  return (
    <aside className="w-56 flex flex-col bg-white border-r border-gray-100 h-full shrink-0">
      <div className="px-5 py-5 border-b border-gray-100">
        <span className="font-bold text-gray-900 text-lg">Sales CRM</span>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1">
        {nav.map(({ href, label }) => {
          const active = href === "/" ? pathname === "/" : pathname.startsWith(href)
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center px-3 py-2 rounded-lg text-sm font-medium transition ${
                active
                  ? "bg-blue-50 text-blue-700"
                  : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
              }`}
            >
              {label}
            </Link>
          )
        })}
      </nav>

      <div className="px-4 py-4 border-t border-gray-100">
        <div className="text-xs text-gray-500 truncate">{user.name}</div>
        <div className="text-xs text-gray-400 truncate">{user.email}</div>
        <div className="text-xs text-gray-400 capitalize mb-3">{user.role?.toLowerCase()}</div>
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="text-xs text-red-500 hover:text-red-700 transition"
        >
          Sign out
        </button>
      </div>
    </aside>
  )
}
