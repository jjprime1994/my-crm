import { readFileSync } from "node:fs"
import { resolve } from "node:path"

const envFile = process.argv[2] ?? ".env.development.local"
for (const line of readFileSync(resolve(process.cwd(), envFile), "utf8").split("\n")) {
  const m = line.match(/^([A-Za-z0-9_]+)=(.*)$/)
  if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "")
}

async function main() {
  const { db } = await import("../src/lib/db")
  const leads = await db.lead.findMany({
    where: { source: "WEBSITE" },
    select: {
      firstName: true, lastName: true, branch: true, claimedAt: true, createdAt: true,
      assignedTo: { select: { name: true, role: true, manager: { select: { name: true } } } },
    },
  })
  for (const l of leads) {
    console.log(`${l.firstName} ${l.lastName} (${l.branch}) — assigned to: ${l.assignedTo?.name} (${l.assignedTo?.role}, manager: ${l.assignedTo?.manager?.name ?? "none"}), created ${l.createdAt.toISOString()}, claimedAt: ${l.claimedAt?.toISOString() ?? "never"}`)
  }
}

main().then(() => process.exit(0))
