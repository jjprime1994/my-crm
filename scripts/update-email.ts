// Update a user's email directly. Usage:
//   npx tsx scripts/update-email.ts <userId> <newEmail> [.env.production.local]

import { readFileSync } from "node:fs"
import { resolve } from "node:path"

const [userId, newEmail] = [process.argv[2], process.argv[3]]
if (!userId || !newEmail) {
  console.error("Usage: npx tsx scripts/update-email.ts <userId> <newEmail> [.env.production.local]")
  process.exit(1)
}
const envFile = process.argv[4] ?? ".env.production.local"
for (const line of readFileSync(resolve(process.cwd(), envFile), "utf8").split("\n")) {
  const m = line.match(/^([A-Za-z0-9_]+)=(.*)$/)
  if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "")
}

async function main() {
  const { db } = await import("../src/lib/db")

  const user = await db.user.findUnique({ where: { id: userId }, select: { id: true, name: true, email: true, role: true } })
  if (!user) {
    console.error("No user with that id.")
    process.exit(1)
  }

  const conflict = await db.user.findUnique({ where: { email: newEmail }, select: { id: true, name: true } })
  if (conflict && conflict.id !== userId) {
    console.error(`Email already in use by ${conflict.name} (${conflict.id}).`)
    process.exit(1)
  }

  const updated = await db.user.update({ where: { id: userId }, data: { email: newEmail }, select: { name: true, email: true, role: true } })
  console.log(`Updated ${updated.name} (${updated.role}): ${user.email} -> ${updated.email}`)
  process.exit(0)
}
main().catch((e) => { console.error(e); process.exit(1) })
