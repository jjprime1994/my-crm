// Look up users by name/email substring (read-only).
// Usage:  npx tsx scripts/find-user.ts <query> [.env.production.local]

import { readFileSync } from "node:fs"
import { resolve } from "node:path"

const query = process.argv[2]
if (!query) {
  console.error("Usage: npx tsx scripts/find-user.ts <query> [.env.production.local]")
  process.exit(1)
}
const envFile = process.argv[3] ?? ".env.production.local"
for (const line of readFileSync(resolve(process.cwd(), envFile), "utf8").split("\n")) {
  const m = line.match(/^([A-Za-z0-9_]+)=(.*)$/)
  if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "")
}

async function main() {
  const { db } = await import("../src/lib/db")
  const users = await db.user.findMany({
    where: { OR: [{ name: { contains: query, mode: "insensitive" } }, { email: { contains: query, mode: "insensitive" } }] },
    select: { id: true, name: true, email: true, role: true, disabled: true, managerId: true, manager: { select: { name: true } } },
  })
  console.log(JSON.stringify(users, null, 2))
  process.exit(0)
}
main().catch((e) => { console.error(e); process.exit(1) })
