# SentryPhish (TryggNät Säkerhet)

Consented phishing-simulation & security-awareness platform for SMBs. Admins run controlled,
consented phishing simulations against their **own** staff, track engagement, and turn every
click into a teachable moment — never capturing real credentials.

> **Status:** Phase 1 (Foundation) complete — multi-tenant auth with a consent record, and
> employee CSV upload. Campaign engine, risk scoring, training, and the full dashboard arrive in
> Phases 2–5.

## Tech stack

npm-workspaces monorepo: **`server`** (Express + Prisma + PostgreSQL, TypeScript) and
**`client`** (Vite + React + Tailwind, TypeScript). JWT auth in an httpOnly cookie. Every
tenant-owned query is scoped by `organizationId`. Deploys to Railway as two services.

## Local development

```bash
docker compose up -d                 # Postgres 16 (+ a sentryphish_test database)
cp server/.env.example server/.env   # then edit JWT_SECRET if you like
npm install                          # installs both workspaces, generates Prisma client
npm run db:migrate                   # apply Prisma migrations to the dev database
npm run dev                          # API on :4000 + client on :5173
npm test                             # server test suite (incl. cross-org isolation)
```

Then open http://localhost:5173 → **Provision your organization** (tick the consent box) →
upload an employee CSV (`name,email,department`) on the Employees page.

Environment files live in `server/` (that is the workspace that consumes them):
`server/.env` (real, gitignored), `server/.env.example` (template), `server/.env.test`
(throwaway test config, committed so the suite is reproducible).

## Responsible use

SentryPhish is an **authorized internal security-awareness tool**, not a phishing kit. These
guardrails are built in, not bolted on:

- **Consent is required and server-enforced.** Creating an organization requires confirming you
  have legal authority to simulate phishing against the employees you upload. The signup API
  rejects the request unless that confirmation is present. The consent record (timestamp +
  hashed IP + the admin who agreed) is stored as an immutable record.
- **No credentials are ever captured.** Simulated landing pages (Phase 2) will record only the
  boolean fact that a form *would* have been submitted. There is **no field anywhere in the
  database schema** to store a password an employee types — this is structural, not a policy.
- **No real-brand impersonation.** Templates use fictional brands (e.g. "Acme IT Portal") so
  they can never be mistaken for a real credential-phishing kit if leaked.
- **Send-abuse prevention.** Sending is rate-limited per org and gated behind domain
  verification (`domainVerified`) before the first real send, so the platform can't be used to
  blast unsolicited mail at arbitrary addresses.

## GDPR & Swedish employment law

- Employee names, emails, and engagement events are **personal data**. Process them under a
  lawful basis (typically *legitimate interest* for security awareness), minimize what you store,
  and set a retention period.
- **Raw IP addresses are never stored** — only salted/hashed values (SHA-256), for the consent
  record and event provenance.
- **Give staff prior notice.** Under Swedish employment law, inform employees (and coordinate
  with worker representatives / fackförbund where applicable) before running simulations. The
  goal is awareness, not entrapment.
- Provide a data-subject access/erasure path for employees as part of your own processes.

## Project layout

```
server/   Express API, Prisma schema (all phases), auth + employees modules, vitest suite
client/   Vite/React SPA, SOC dark design system, auth + employees + landing pages
docs/superpowers/   design spec + implementation plan
docker-compose.yml  local Postgres (+ test DB)
railway.json        Railway deploy config (API service)
```

## Deployment

Deploys as a **single Vercel project** — the Vite client served statically and the Express API
as a serverless function at `/api/*` on the same domain, backed by a serverless Postgres (Neon).
Step-by-step instructions (Neon setup, env vars, one-click import) are in **[DEPLOY.md](DEPLOY.md)**.

A split alternative (frontend on Vercel, backend + Postgres on Railway via `railway.json`) is also
documented at the bottom of DEPLOY.md.
