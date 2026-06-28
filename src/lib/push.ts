import webpush from "web-push"
import { db } from "./db"

webpush.setVapidDetails(
  process.env.VAPID_SUBJECT!,
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
)

export async function sendPushToUser(userId: string, payload: { title: string; body: string; url?: string }) {
  const subs = await db.pushSubscription.findMany({ where: { userId } })
  await Promise.allSettled(
    subs.map((sub) =>
      webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        JSON.stringify(payload)
      ).catch(async (err) => {
        // Remove expired/invalid subscriptions
        if (err.statusCode === 410 || err.statusCode === 404) {
          await db.pushSubscription.delete({ where: { id: sub.id } })
        }
      })
    )
  )
}

export async function sendPushToSuperAdmins(payload: { title: string; body: string; url?: string }) {
  const superAdmins = await db.user.findMany({
    where: { role: "SUPER_ADMIN", pushSubscriptions: { some: {} } },
    select: { id: true },
  })
  await Promise.allSettled(superAdmins.map((u) => sendPushToUser(u.id, payload)))
}
