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
```

## Architecture

**Nu Vending CRM** — a lead management system for a vending machine sales team. Leads flow in from Facebook/Instagram Lead Ads via a Meta webhook, then salespeople claim and work them.

### Stack

- **Next.js 16** / **React 19** — App Router only, no Pages Router
- **NextAuth v5** (beta) — credentials-based auth, JWT sessions
- **Prisma 7** + **PostgreSQL** — via `@prisma/adapter-pg` driver adapter
- **Tailwind CSS v4**

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
