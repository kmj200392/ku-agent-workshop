# Deployment

This checkout runs independently from ChatGPT Sites.

- Hosting: GitHub → Vercel (Next.js, Node24)
- Address: https://agent.minjaek.im (Cloudflare DNS)
- Storage: Turso SQLite on the free Starter plan
- Identity: nickname + generated personal participant code; HttpOnly session cookies
- Execution: Python/Pyodide, tools and BFCL grading remain browser-local

## Configuration

Connect the Turso integration to the Vercel project. It supplies server-only `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN`; never use a NEXT_PUBLIC prefix. Vercel runs `npm run db:migrate && npm run build`. Migrations are additive and idempotent. No database file or school API key is deployed.

Local setup: `npm ci`; set `TURSO_DATABASE_URL=file:./workshop.db` in ignored `.env.local`; run `npm run db:migrate`, then `npm run dev`.

## Participant access

Create a nickname once and save the144-bit random participant code shown once. The server stores only its SHA-256 digest. Logging in issues a separate256-bit session token stored as a digest, with a30-day lifetime. Cookies use HttpOnly, SameSite=Lax and Secure in production. Logout revokes the session. Codes are not tied to nickname uniqueness, and nicknames do not grant access. Auth requests have per-minute limits sized for a40-person shared classroom network.

This remains a classroom leaderboard of client-reported scores, not a secure proctored competition. Students can inspect local tasks and scoring. School API keys stay in page memory and only go directly to the school Gateway.

Existing Sites participant IDs cannot be mapped to these new identities automatically. The old deployment and its stored data remain unchanged. The new domain has a different browser origin, so saved editor/demo output does not automatically transfer.
