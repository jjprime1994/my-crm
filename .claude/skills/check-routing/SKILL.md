---
name: check-routing
description: Verify lead-routing invariants against the database (state visibility, counter accuracy, claim limits). Run after any change to routing, claiming, or the available-leads counter, and whenever the user reports "team X can see state Y leads" or "counter shows leads that aren't there".
---

# Check Routing Invariants

Runs `scripts/check-routing.ts`, which calls the real `getAvailableLeads` / `getAvailableLeadsCount` from `src/lib/available-leads.ts` for every user and asserts the rules in CLAUDE.md → "Lead Routing Rules". It is read-only (apart from the idempotent startup DDL in `db.ts` that runs on every boot anyway).

```
npx tsx scripts/check-routing.ts .env.development.local
npx tsx scripts/check-routing.ts .env.production.local   # check live data
```

If the env file is missing, pull it first (see the /db skill): `vercel env pull .env.development.local`.

Checks:
1. Counter == claimable-list length for every user (the recurring badge bug).
2. StateRoute members see only leads whose `branch` is in their route's states.
3. Nobody exceeded `claimLimit` claims within the current rolling 15-minute window.

Exit 0 = all invariants hold. Exit 1 prints each violation — fix the **code** to conform to the CLAUDE.md rules; only touch the data if the user asks. If tsx fails to resolve the `@/` path alias, retry with `npx tsx --tsconfig tsconfig.json scripts/check-routing.ts`.
