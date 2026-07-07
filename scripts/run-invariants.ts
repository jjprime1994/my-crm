// Runs the EXACT invariant suite the nightly cron runs (src/lib/routing-invariants.ts)
// against a live database — pool invariants + recent-assignment audit + claim limits.
//
// Usage:  npx tsx scripts/run-invariants.ts [.env.production.local]
// Exit 0 = clean; exit 1 = violations printed below.

import { readFileSync } from "node:fs"
import { resolve } from "node:path"

const envFile = process.argv[2] ?? ".env.production.local"
for (const line of readFileSync(resolve(process.cwd(), envFile), "utf8").split("\n")) {
  const m = line.match(/^([A-Za-z0-9_]+)=(.*)$/)
  if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "")
}

async function main() {
  const { checkRoutingInvariants } = await import("../src/lib/routing-invariants")
  const started = Date.now()
  const violations = await checkRoutingInvariants()
  console.log(`Ran in ${((Date.now() - started) / 1000).toFixed(1)}s`)

  if (violations.length > 0) {
    console.error(`\n❌ ${violations.length} violation(s):`)
    for (const v of violations) console.error(` - ${v}`)
    process.exit(1)
  }
  console.log("✅ All invariants hold (pool routing, recent assignments, claim limits).")
  process.exit(0)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
