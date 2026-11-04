import { db } from "@/lib/db"

const CLAIMING_PAUSED = "claimingPaused"

// Claim system pause switch (commission mode). While paused, Available Leads / Available
// Appointments are hidden and both claim endpoints refuse. Nothing is deleted — un-pausing
// restores the old flow exactly. If the setting row is missing, claiming is NOT paused.
export async function isClaimingPaused(): Promise<boolean> {
  const row = await db.appSetting.findUnique({ where: { key: CLAIMING_PAUSED } }).catch(() => null)
  return row?.value === "true"
}

export async function setClaimingPaused(paused: boolean): Promise<void> {
  await db.appSetting.upsert({
    where: { key: CLAIMING_PAUSED },
    create: { key: CLAIMING_PAUSED, value: String(paused) },
    update: { value: String(paused) },
  })
}
