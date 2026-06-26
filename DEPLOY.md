# Deploying SentryPhish to Vercel (single project)

SentryPhish deploys as **one Vercel project**: the Vite client is served as static files, and
the Express API runs as a serverless function at `/api/*` on the same domain (so cookies stay
same-origin). PostgreSQL is provided by a serverless Postgres — **Neon** (also what "Vercel
Postgres" uses under the hood).

You'll do this from the Vercel dashboard — no CLI needed. ~5 minutes.

## How the pieces map

| Piece | Where | Notes |
|-------|-------|-------|
| Client (Vite SPA) | Vercel static (`client/dist`) | built by `vercel-build` |
| Express API | Vercel serverless function | `api/[...path].ts` re-exports `createApp()` |
| Postgres | Neon | pooled URL for the app, direct URL for migrations |
| Routing | `vercel.json` | `/api/*` → function; everything else → `index.html` |

## Steps

### 1. Create the database (Neon)
1. Go to <https://neon.tech> → create a project (any region near your users).
2. Copy **two** connection strings from the Neon dashboard:
   - **Pooled** connection (host contains `-pooler`) → this is `DATABASE_URL`.
   - **Direct** connection (no `-pooler`) → this is `DIRECT_URL`.
   Both should end with `?sslmode=require`.

> "Vercel Postgres" works too (Storage tab → Postgres). It exposes the same pooled/direct URLs.

### 2. Import the repo into Vercel
1. <https://vercel.com/new> → **Import Git Repository** → pick `Rsaas762/sentryphish`.
2. Framework preset: **Other** (the included `vercel.json` already defines the build).
3. Leave Root Directory as the repo root.

### 3. Set environment variables (Vercel → Project → Settings → Environment Variables)
| Name | Value |
|------|-------|
| `DATABASE_URL` | Neon **pooled** connection string |
| `DIRECT_URL` | Neon **direct** connection string |
| `JWT_SECRET` | a long random string (e.g. `openssl rand -hex 32`) |
| `NODE_ENV` | `production` |
| `COOKIE_SECURE` | `true` |
| `CLIENT_ORIGIN` | your Vercel URL, e.g. `https://sentryphish.vercel.app` |

Add them to **Production** (and Preview if you want preview deploys to work).

### 4. Deploy
Click **Deploy**. The build runs `vercel-build`, which:
1. applies Prisma migrations to Neon (`prisma migrate deploy`, via `DIRECT_URL`), then
2. builds the client to `client/dist`.

On every `git push` to `master`, Vercel redeploys automatically.

### 5. Smoke-test the live URL
1. Open `https://<your-app>.vercel.app` → the landing page loads.
2. **Provision your organization** (tick consent) → you should land on the dashboard.
3. Go to **Employees** → upload a CSV (`name,email,department`) → rows appear.

## Notes & troubleshooting

- **Prisma engine on Vercel:** the schema sets
  `binaryTargets = ["native", "rhel-openssl-1.0.x", "rhel-openssl-3.0.x"]` so the Linux query
  engine ships with the function. `prisma generate` runs automatically via the server's
  `postinstall`. If a deploy logs *"Query engine library for current platform … could not be
  found"*, confirm those `binaryTargets` are present and redeploy (clear build cache).
- **Cookies:** same-origin (`sameSite=lax`) + `COOKIE_SECURE=true` over Vercel's HTTPS. No CORS
  config is needed because the client and API share a domain.
- **Migrations** use `DIRECT_URL` (unpooled) to avoid pooler/advisory-lock issues; the running
  app uses the pooled `DATABASE_URL`.
- **Cold starts:** Neon may auto-suspend on the free tier; the first request after idle takes a
  second or two to wake the database. Fine for a demo/portfolio.

## Alternative: split deployment (frontend Vercel + backend Railway)

If you'd rather run the backend as a normal long-lived server, deploy `server` to Railway
(see `railway.json`) and only the client to Vercel. You'd then set `VITE_API_URL` to the Railway
API URL at build time, switch the cookie to `sameSite=None; Secure` (cross-domain), and set
`CLIENT_ORIGIN` on the API to the Vercel URL. The single-project setup above is simpler and is
the recommended path.
