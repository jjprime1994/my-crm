"use client"

import { useEffect } from "react"
import { PATCH_NOTES } from "@/lib/patch-notes"

export default function PatchNotesPage() {
  useEffect(() => {
    if (PATCH_NOTES.length > 0) {
      localStorage.setItem("lastSeenPatchVersion", PATCH_NOTES[0].version)
    }
  }, [])
  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">What's New</h1>
        <p className="text-sm text-gray-500 mt-0.5">Latest updates and improvements to the CRM</p>
      </div>

      <div className="relative">
        <div className="absolute left-4 top-0 bottom-0 w-px bg-gray-100" />
        <div className="space-y-6">
          {PATCH_NOTES.map((note, i) => (
            <div key={note.version} className="relative pl-10">
              <div className={`absolute left-0 w-8 h-8 rounded-full flex items-center justify-center ring-4 ring-white ${i === 0 ? "bg-blue-600" : "bg-gray-200"}`}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={i === 0 ? "white" : "#9ca3af"} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                <div className="flex items-start justify-between gap-3 flex-wrap mb-3">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h2 className="text-base font-bold text-gray-900">{note.title}</h2>
                      {i === 0 && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 ring-1 ring-blue-200">Latest</span>
                      )}
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5">
                      v{note.version} · {new Date(note.date).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
                    </p>
                  </div>
                </div>
                <ul className="space-y-2">
                  {note.items.map((item, j) => (
                    <li key={j} className="flex items-start gap-2 text-sm text-gray-700">
                      <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-blue-400 shrink-0" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
