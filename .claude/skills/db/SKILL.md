---
name: db
description: Run Prisma/database commands safely (migrations, studio, status) with the right env file. Use for any DATABASE_URL problem, migration task, or "datasource.url property is required" error.
---

# Database Operations

The Prisma CLI does not read `.env.development.local` on its own — every "datasource.url property is required" error is this, not a broken database. Never ask the user for a connection string and never echo one into chat, commands, or files.

**Get env files from Vercel (once per machine):**

```
vercel env pull .env.development.local
vercel env pull .env.production.local --environment=production
```

**KNOWN GOTCHA (verified 2026-07-02):** the project's env vars are marked **Sensitive** in Vercel, so `vercel env pull` writes them as EMPTY strings (`DATABASE_URL=""`). If the pulled file has empty values, do NOT loop on pull — the fix is in the Vercel dashboard: Project → Settings → Environment Variables → edit `DATABASE_URL` → untick "Sensitive" (or re-add it unmarked), then pull again. Only the user can do this. Alternatively the user copies the value from the Neon console into `.env.development.local` themselves — never through chat.

**Run Prisma through dotenv-cli** (the package is `dotenv-cli` — plain `npx dotenv` resolves to a different package and fails with "could not determine executable to run"):

```
npx dotenv-cli -e .env.development.local -- npx prisma migrate dev
npx dotenv-cli -e .env.development.local -- npx prisma migrate status
npx dotenv-cli -e .env.development.local -- npx prisma studio
npx dotenv-cli -e .env.production.local  -- npx prisma migrate deploy
```

Rules:
- Against production: `migrate status`, `migrate deploy`, and read-only queries only. Never `migrate dev`, `db push`, or destructive SQL on production.
- One-off inspection scripts belong in `scripts/` and should load env the way `scripts/check-routing.ts` does (parse the env file, don't hardcode).
- If a connection string ever leaks into chat, a command, or a settings file: tell the user to rotate the password in the Neon console, then re-pull the env files.
