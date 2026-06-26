# Deploying SentryPhish

SentryPhish runs as a **single service**: the Express server serves the built React client
*and* the API on one domain, backed by PostgreSQL. The recommended host is **Railway** (a
long-lived server + managed Postgres — the architecture this app was designed for). A Vercel
serverless alternative is documented at the end.

---

## Railway (recommended)

One service from this repo + a Postgres plugin. ~5 minutes, no CLI required.

### How the pieces map

| Piece | Where |
|-------|-------|
| Client (Vite SPA) | Built to `client/dist`, served by Express as static + SPA fallback |
| API (Express) | Same service, routes under `/api/*` |
| Postgres | Railway Postgres plugin |
| Build / start / healthcheck | `railway.json` |

### Steps

1. **Create the project** — <https://railway.app> → *New Project* → *Deploy from GitHub repo* →
   pick `Rsaas762/sentryphish`. Railway reads `railway.json` for build/start/healthcheck.
2. **Add Postgres** — in the project, *New* → *Database* → *Add PostgreSQL*.
3. **Set the app service's variables** (Variables tab):

   | Name | Value |
   |------|-------|
   | `DATABASE_URL` | `${{Postgres.DATABASE_URL}}` (reference the Postgres service) |
   | `DIRECT_URL` | `${{Postgres.DATABASE_URL}}` (same — Railway Postgres isn't pooled) |
   | `JWT_SECRET` | a long random string — `openssl rand -hex 32` |
   | `NODE_ENV` | `production` |
   | `COOKIE_SECURE` | `true` |
   | `CLIENT_ORIGIN` | your Railway URL once generated, e.g. `https://sentryphish.up.railway.app` |

   > `PORT` is injected by Railway automatically — don't set it. The server reads it.
4. **Generate a domain** — Settings → Networking → *Generate Domain*. Put that URL in
   `CLIENT_ORIGIN` (step 3) and redeploy.
5. **Deploy.** Railway runs:
   - **build:** `npm run build` (Prisma client via `postinstall`, then server `tsc` + client `vite build`)
   - **start:** `npm run db:migrate:deploy -w server` (applies migrations) then `npm run start -w server` (`node dist/index.js`)
   - **healthcheck:** `GET /health`

   Every push to `master` redeploys automatically.

### Smoke-test the live URL
1. Open the Railway URL → the landing page loads.
2. **Provision your organization** (tick consent) → you land on the dashboard.
3. **Employees** → upload a CSV (`name,email,department`) → rows appear.

### Notes
- **Single origin** ⇒ `sameSite=lax` cookies + `COOKIE_SECURE=true` over Railway's HTTPS; no CORS needed.
- **Migrations** run on every deploy via `prisma migrate deploy` (idempotent — only applies pending).
- The Prisma schema includes Linux `binaryTargets`, so the query engine ships correctly on Railway.

---

## Alternative: Vercel (serverless)

The repo is also configured to deploy all-on-Vercel (static client + Express as a serverless
function under `/api`) with a **Neon** Postgres. This works but has the usual serverless/Prisma
caveats (cold starts, occasional engine-tracing cache-clear). Use it only if you specifically
want Vercel.

1. **Neon** (<https://neon.tech>) → new project → copy the **pooled** string (`DATABASE_URL`)
   and the **direct** string (`DIRECT_URL`).
2. **vercel.com/new** → import `Rsaas762/sentryphish` (preset: *Other*; `vercel.json` defines the build).
3. Env vars: `DATABASE_URL` (pooled), `DIRECT_URL` (direct), `JWT_SECRET`, `NODE_ENV=production`,
   `COOKIE_SECURE=true`, `CLIENT_ORIGIN=https://<app>.vercel.app`.
4. Deploy. If a build logs *"Query engine … could not be found"*, clear the build cache and redeploy.

The relevant files: `vercel.json` (routing) and `api/[...path].ts` (re-exports the Express app).
