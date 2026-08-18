// Reset a user's password directly (bcrypt cost 12, matching the app's own reset path
// in src/app/api/users/[id]/route.ts). Generates a random password if none is given.
// Usage:  npx tsx scripts/reset-password.ts <userId> [.env.production.local]

import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import crypto from "node:crypto"

const userId = process.argv[2]
if (!userId) {
  console.error("Usage: npx tsx scripts/reset-password.ts <userId> [.env.production.local]")
  process.exit(1)
}
const envFile = process.argv[3] ?? ".env.production.local"
for (const line of readFileSync(resolve(process.cwd(), envFile), "utf8").split("\n")) {
  const m = line.match(/^([A-Za-z0-9_]+)=(.*)$/)
  if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "")
}

async function main() {
  const { db } = await import("../src/lib/db")
  const bcrypt = (await import("bcryptjs")).default

  const user = await db.user.findUnique({ where: { id: userId }, select: { id: true, name: true, email: true, role: true } })
  if (!user) {
    console.error("No user with that id.")
    process.exit(1)
  }

  const newPassword = crypto.randomBytes(9).toString("base64url") // 12 chars, url-safe
  const hashed = await bcrypt.hash(newPassword, 12)
  await db.user.update({ where: { id: userId }, data: { password: hashed } })

  console.log(`Password reset for ${user.name} (${user.email}, ${user.role}).`)
  console.log(`New password: ${newPassword}`)
  process.exit(0)
}
main().catch((e) => { console.error(e); process.exit(1) })
