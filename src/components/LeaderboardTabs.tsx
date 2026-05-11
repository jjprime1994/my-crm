"use client"

import { useState } from "react"

export type IndividualRow = {
  id: string
  name: string
  totalLeads: number
  won: number
  rate: number
}

export type TeamRow = {
  managerId: string
  managerName: string
  memberCount: number
  totalLeads: number
  won: number
  rate: number
}

interface Props {
  individuals: IndividualRow[]
  teams: TeamRow[]
}

export default function LeaderboardTabs({ individuals, teams }: Props) {
  const [tab, setTab] = useState<"individual" | "team">("individual")

  const maxIndividualLeads = Math.max(...individuals.map((r) => r.totalLeads), 1)
  const maxTeamLeads = Math.max(...teams.map((r) => r.totalLeads), 1)

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-50">
        <h2 className="font-semibold text-gray-900">Leaderboard</h2>
        <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
          <button
            onClick={() => setTab("individual")}
            className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition ${
              tab === "individual" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
            }`}
          >
            Individual
          </button>
          <button
            onClick={() => setTab("team")}
            className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition ${
              tab === "team" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
            }`}
          >
            By Team
          </button>
        </div>
      </div>

      {tab === "individual" ? (
        <table className="min-w-full">
          <thead>
            <tr className="border-b border-gray-50 bg-gray-50/40">
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">Rank</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">Salesperson</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">Leads</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">Won</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide min-w-[160px]">Conversion</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {individuals.length === 0 && (
              <tr>
                <td colSpan={5} className="px-6 py-10 text-center text-sm text-gray-400">No salesperson data yet.</td>
              </tr>
            )}
            {individuals.map((row, i) => (
              <tr key={row.id} className="hover:bg-gray-50/70 transition">
                <td className="px-6 py-4">
                  <span className={`text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center ${
                    i === 0 ? "bg-amber-100 text-amber-700" :
                    i === 1 ? "bg-gray-100 text-gray-600" :
                    i === 2 ? "bg-orange-50 text-orange-600" : "text-gray-400"
                  }`}>
                    {i + 1}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                      <span className="text-xs font-bold text-blue-600">{row.name[0].toUpperCase()}</span>
                    </div>
                    <span className="font-medium text-gray-900 text-sm">{row.name}</span>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-2">
                    <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full bg-blue-400 rounded-full" style={{ width: `${Math.round((row.totalLeads / maxIndividualLeads) * 100)}%` }} />
                    </div>
                    <span className="text-sm font-semibold text-gray-900">{row.totalLeads}</span>
                  </div>
                </td>
                <td className="px-6 py-4 text-sm font-semibold text-emerald-600">{row.won}</td>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${row.rate}%` }} />
                    </div>
                    <span className="text-sm font-bold text-emerald-600 w-10 text-right">{row.rate}%</span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <table className="min-w-full">
          <thead>
            <tr className="border-b border-gray-50 bg-gray-50/40">
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">Rank</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">Team (Manager)</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">Members</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">Leads</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">Won</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide min-w-[160px]">Conversion</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {teams.length === 0 && (
              <tr>
                <td colSpan={6} className="px-6 py-10 text-center text-sm text-gray-400">No teams set up yet. Assign managers to salespersons in Manage Team.</td>
              </tr>
            )}
            {teams.map((row, i) => (
              <tr key={row.managerId} className="hover:bg-gray-50/70 transition">
                <td className="px-6 py-4">
                  <span className={`text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center ${
                    i === 0 ? "bg-amber-100 text-amber-700" :
                    i === 1 ? "bg-gray-100 text-gray-600" :
                    i === 2 ? "bg-orange-50 text-orange-600" : "text-gray-400"
                  }`}>
                    {i + 1}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-violet-100 flex items-center justify-center shrink-0">
                      <span className="text-xs font-bold text-violet-600">{row.managerName[0].toUpperCase()}</span>
                    </div>
                    <div>
                      <p className="font-medium text-gray-900 text-sm">{row.managerName}&apos;s Team</p>
                      <p className="text-xs text-gray-400">{row.memberCount} member{row.memberCount !== 1 ? "s" : ""}</p>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 text-sm text-gray-600">{row.memberCount}</td>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-2">
                    <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full bg-violet-400 rounded-full" style={{ width: `${Math.round((row.totalLeads / maxTeamLeads) * 100)}%` }} />
                    </div>
                    <span className="text-sm font-semibold text-gray-900">{row.totalLeads}</span>
                  </div>
                </td>
                <td className="px-6 py-4 text-sm font-semibold text-emerald-600">{row.won}</td>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${row.rate}%` }} />
                    </div>
                    <span className="text-sm font-bold text-emerald-600 w-10 text-right">{row.rate}%</span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
