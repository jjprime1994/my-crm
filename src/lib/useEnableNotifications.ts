"use client"

import { useState, useEffect, useCallback } from "react"

export type NotifStatus = "unsupported" | "default" | "granted" | "denied" | "loading"

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/")
  const rawData = atob(base64)
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)))
}

export function useEnableNotifications() {
  const [status, setStatus] = useState<NotifStatus>("default")

  useEffect(() => {
    if (!("Notification" in window) || !("serviceWorker" in navigator)) {
      setStatus("unsupported")
      return
    }
    if (Notification.permission === "granted") setStatus("granted")
    else if (Notification.permission === "denied") setStatus("denied")
  }, [])

  const enable = useCallback(async () => {
    setStatus("loading")
    try {
      const permission = await Notification.requestPermission()
      if (permission !== "granted") { setStatus("denied"); return }

      const reg = await navigator.serviceWorker.register("/sw.js")
      await navigator.serviceWorker.ready

      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!),
      })

      await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(sub),
      })

      setStatus("granted")
    } catch {
      setStatus("default")
    }
  }, [])

  const disable = useCallback(async () => {
    try {
      const reg = await navigator.serviceWorker.getRegistration("/sw.js")
      const sub = await reg?.pushManager.getSubscription()
      if (sub) {
        await fetch("/api/push/subscribe", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        })
        await sub.unsubscribe()
      }
      setStatus("default")
    } catch {}
  }, [])

  return { status, enable, disable }
}
