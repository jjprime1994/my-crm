---
name: deploy-verify
description: Deploy the CRM to Vercel production and verify it is actually live. Use when the user says "deploy", "push it live", "is it live?", or after finishing a change that should ship.
---

# Deploy & Verify

Run from the project root. One deploy, then diagnose — never re-run `vercel --prod` hoping it sticks.

1. **Preflight**
   - `npx tsc --noEmit` — abort and fix if it fails.
   - If `.vercel/project.json` is missing, run `vercel link --yes` first.
   - Uncommitted changes? Commit and push first so git matches production (the user works from multiple PCs).
2. **Deploy**: `vercel --prod --yes` and capture the deployment URL from the output. If it fails, fetch the build log with `vercel inspect --logs <deployment-url>`, fix the root cause, and only then deploy again.
3. **Verify** (never skip)
   - `vercel inspect <deployment-url>` → status must be **Ready**.
   - Smoke test the production domain: `curl -s -o /dev/null -w "%{http_code}" https://<production-domain>/` — expect 200 or an auth redirect (302/307).
4. **Report**: "Live at <production URL>" plus a one-line summary of what shipped — or the exact build error. Never report success without step 3.
