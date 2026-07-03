# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Commands

```bash
npm run dev       # start dev server at localhost:3000
npm run build     # production build
npm run lint      # ESLint
npx prisma migrate dev   # run DB migrations
npx prisma studio        # browse DB in browser
npx prisma generate      # regenerate client after schema changes (also runs on postinstall)
```

## Environment Variables

```
DATABASE_URL              # PostgreSQL connection string
NEXTAUTH_SECRET           # NextAuth JWT secret
META_VERIFY_TOKEN         # Token for Meta webhook verification handshake
META_APP_SECRET           # Used to verify HMAC-SHA256 signatures on incoming webhook payloads
META_PAGE_ACCESS_TOKEN    # Facebook Graph API token for fetching lead details
WEBSITE_FORM_SECRET       # Shared secret the website's contact form (or its backend) sends as x-website-secret
```

## Architecture

**Nu Vending CRM** — a lead management system for a vending machine sales team. Leads flow in from Facebook/Instagram Lead Ads via a Meta webhook, then salespeople claim and work them.

### Stack

- **Next.js 16** / **React 19** — App Router only, no Pages Router
- **NextAuth v5** (beta) — credentials-based auth, JWT sessions
- **Prisma 7** + **PostgreSQL** — via `@prisma/adapter-pg` driver adapter
- **Tailwind CSS v4**
- **shadcn/ui** — standard UI component library (buttons, modals, forms, dropdowns, inputs, charts, etc.). Always use shadcn/ui components for new UI work. Add components via `npx shadcn@latest add <component>`. Tremor is NOT installed — shadcn/ui charts cover dashboard needs.

### Data Model

Three roles: `SUPER_ADMIN > ADMIN > SALESPERSON`. Each `User` has a `claimLimit` (default 5).

`Lead` lifecycle: `NEW → CONTACTED → QUALIFIED → PROPOSAL → CLOSED_WON / CLOSED_LOST`

Leads arrive unassigned (`assignedToId: null`). They become "available" for salespeople to self-claim, or admins can assign them directly.

### Key Patterns

**Server → Client split**: Every dashboard page is a React Server Component that fetches data from Prisma and passes it as props to a `*Client.tsx` component in `src/components/`. All interactivity lives in the client component; all DB access lives in the page.

**Auth**: Use `auth()` from `@/auth` in server components/route handlers. The session includes `user.id` and `user.role`. Role checks go through `isAdmin()` / `isSuperAdmin()` in `src/lib/roles.ts`.

**Database**: Always import `db` from `@/lib/db`. The Prisma client is generated into `src/generated/prisma/` (non-default location) — always import types from `@/generated/prisma/client`, never from `@prisma/client`.

**Route params**: In Next.js 16, dynamic route params are `Promise<{ id: string }>` — always `await params` before destructuring.

### Role-Based Access

| Feature | SALESPERSON | ADMIN | SUPER_ADMIN |
|---|---|---|---|
| View own leads | ✓ | ✓ | ✓ |
| Claim available leads | ✓ | — | — |
| Assign leads to others | — | ✓ | ✓ |
| Manage team (users) | — | ✓ | ✓ |
| Overview stats | — | — | ✓ |
| Export CSV | — | — | ✓ |

**Claim rate limiting**: Salespeople can claim at most `claimLimit` leads per rolling 15-minute window. The API returns HTTP 429 with a countdown when the limit is hit.

### Meta Webhook

`POST /api/webhooks/meta` receives Facebook Lead Ads notifications. It verifies the `x-hub-signature-256` HMAC signature, then calls the Graph API to fetch the full lead record (`/v19.0/{leadgen_id}`), plus ad and campaign names. Leads are upserted by `metaLeadId` to avoid duplicates. Always returns `{ ok: true }` with HTTP 200 to prevent Meta from retrying — even on signature mismatch.

`GET /api/webhooks/meta` handles the one-time webhook verification handshake Meta performs when you register the webhook URL.

### Website Enquiries Webhook

`POST /api/webhooks/website` receives contact-form enquiries from the company website. Unlike Meta/TikTok this isn't a platform with its own retry policy, so it returns real HTTP status codes (401/400/500) instead of always-200.

- **Auth**: the caller must send header `x-website-secret` matching `WEBSITE_FORM_SECRET`. There's no HMAC here — a browser form has no way to hold a server secret — so this only works safely if the website's own backend makes the call (not client-side JS), otherwise the secret is visible in the page source.
- **Body** (JSON): `name` (or `firstName`/`lastName`), `email`, `phone`, `state` (free-text, resolved via `resolveStateBranch`), `message` (optional — stored as a `LeadNote`), `honeypot` (optional — if non-empty, silently returns `{ ok: true }` without creating a lead).
- Requires at least one of `email`/`phone`.
- **Routing**: same as Meta — resolves `branch` from the submitted state, tries `assignLeadByBranch` (StateRoute round-robin, shared with the Meta webhook via `src/lib/route-lead.ts`), falls back to `assignToDefaultTeam()`.
- **Dedup**: same 30-day active-lead-by-phone/email check as Meta/TikTok; duplicates are flagged (`isDuplicate: true`) but still recorded, unassigned.
- Leads are created with `source: "WEBSITE"`.

As of 2026-07-03, the live website (nuvendingtech.com, WordPress + Divi) does not call this endpoint yet — a site revamp is planned within weeks, and this endpoint is built ahead of that so the new site (whatever stack it uses) just needs to POST here. Wiring up the current Divi site was deliberately skipped since it'd use Divi's native contact form module, which has no webhook support and would be replaced anyway.

## Windows / Shell Rules

Development happens on Windows 11 with **Windows PowerShell 5.1** (not PowerShell 7):

- No `&&` / `||` chaining, no ternary `?:`, no `?.` / `??` operators — parser errors in 5.1. Use `;` and `if/else`.
- Never run PowerShell cmdlets (`Get-ChildItem`, `Select-Object`, `Get-Content`, `Start-Sleep`, `2>$null`, …) through the Bash tool — Bash is Git Bash and takes POSIX only (`ls`, `grep`, `cat`, `sleep`, `2>/dev/null`).
- The project path is under OneDrive and contains spaces — always quote it. Launch sessions from the project root (the `crm` PowerShell command from `setup-pc.ps1`), not from the home directory.
- Use the `py` launcher for Python, never `python` (the Microsoft Store stub intercepts it).
- Never update Claude Code from inside a running session — the exe is locked (EBUSY). Close Claude Code first, then `npm i -g @anthropic-ai/claude-code`.

## Database Access

- **Never print, request, or hardcode the `DATABASE_URL` / connection string** — not in chat, not in commands, not in settings files. If one leaks, the Neon password must be rotated.
- Env files come from Vercel, not from the user: `vercel env pull .env.development.local` (dev), `vercel env pull .env.production.local --environment=production` (prod).
- **Gotcha**: this project's env vars are marked *Sensitive* in Vercel, so `env pull` writes them as EMPTY (`DATABASE_URL=""`). Pulling again won't help — the user must untick "Sensitive" on the variable in the Vercel dashboard (or fill the local file from the Neon console themselves). See the `/db` skill.
- The Prisma CLI doesn't read `.env.*.local` on its own — that's what every "datasource.url property is required" error means. Use the `/db` skill pattern: `npx dotenv-cli -e .env.development.local -- npx prisma <cmd>` (the package is `dotenv-cli`, NOT `dotenv` — `npx dotenv` fails with "could not determine executable to run").
- Production DB: `migrate status` / `migrate deploy` / read-only queries only. Never `migrate dev` or `db push` against production.

## Deploying

Use the `/deploy-verify` skill. Never re-run `vercel --prod` repeatedly hoping it sticks — on failure read the build log (`vercel inspect --logs <url>`), fix the cause, deploy once more, and always confirm Ready + report the live URL.

## Lead Routing Rules (business logic — code must conform to these)

These rules come from the owner and are the source of truth. When changing routing/claiming/counter code, re-read this list and run `/check-routing` afterward.

1. **State routing is strict**: members of a `StateRoute` see and claim ONLY unassigned leads whose `branch` (Malaysian state) is in their route. A Penang team member must never see a Selangor lead. New leads for a state distribute round-robin (`lastAssignedIndex`).
2. **Ad routing**: `AdRoute` maps an `adName` to admin teams (`teamIds`). A salesperson's visibility comes from their *effective admin* (manager, or manager's manager — see `getEffectiveAdmin` in `src/lib/available-leads.ts`); that admin's `coveredStates` and `isDefaultTeam` decide what the team sees.
3. **Default team is the catch-all**: unrouted ads, no-source/no-state leads, and leads whose assigned teams don't cover the lead's state fall to the default team — and only to it, when one exists.
4. **The available-leads counter must equal the claimable list**: count and list must go through the same filter (`filterLeads`). A badge showing leads the user can't actually claim is a bug — this has regressed multiple times.
5. **Claim limit**: at most `claimLimit` (default 5) claims per rolling 15-minute window → HTTP 429 with countdown. Reassigning leads to teammates must not bypass the limit.
6. **Roles**: SUPER_ADMIN sees all unassigned leads and all users' claimed leads (not just salespeople's). Salespeople claim; admins assign; only SUPER_ADMIN gets overview stats and CSV export.

## Verification Required

A bug is not "fixed" until verified end-to-end: exercise the affected flow (query the DB, hit the endpoint, load the page) — don't just typecheck. After routing/claim/counter changes, run `/check-routing`. After every deploy, confirm the deployment is Ready and report the live URL. One-off debug scripts go in `scripts/` and load env like `scripts/check-routing.ts` does.
