"use client"

import { createContext, useCallback, useContext, useRef, useState } from "react"

type ToastType = "success" | "error"
type ToastItem = { id: number; message: string; type: ToastType }

const Ctx = createContext<(msg: string, type?: ToastType) => void>(() => {})

export function useToast() {
  return useContext(Ctx)
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const counter = useRef(0)

  const show = useCallback((message: string, type: ToastType = "success") => {
    const id = ++counter.current
    setToasts(prev => [...prev, { id, message, type }])
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3500)
  }, [])

  return (
    <Ctx.Provider value={show}>
      {children}
      <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2 pointer-events-none">
        {toasts.map(t => (
          <div
            key={t.id}
            className={`flex items-center gap-2.5 px-4 py-3 rounded-2xl shadow-lg text-sm font-medium text-white pointer-events-auto ${
              t.type === "error" ? "bg-rose-500" : "bg-gray-900"
            }`}
          >
            {t.type === "success" ? (
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
            ) : (
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            )}
            {t.message}
          </div>
        ))}
      </div>
    </Ctx.Provider>
  )
}
