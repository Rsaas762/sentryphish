# SentryPhish Phase 1 (Foundation) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the SentryPhish monorepo with admin auth (signup with a server-enforced consent record, login/logout), strict multi-tenant isolation, and employee CSV upload — all in the dark "security operations center" design language.

**Architecture:** npm-workspaces monorepo (`server` Express+Prisma API, `client` Vite/React SPA). Postgres 16 via Docker Compose. JWT issued in an httpOnly cookie. Every tenant-owned query is scoped by `organizationId` taken from the verified token. Backend is built test-first with vitest + supertest against a dedicated test database.

**Tech Stack:** TypeScript, Node 20, Express 4, Prisma 6 + PostgreSQL 16, zod, bcryptjs, jsonwebtoken, multer, csv-parse, Vite + React 18 + React Router + Tailwind, vitest + supertest.

## Global Constraints

- **Language:** TypeScript everywhere. Server compiles as CommonJS (`module: commonjs`) to avoid ESM import-extension friction.
- **Type pairing:** IBM Plex Mono (all numerics/metrics) + IBM Plex Sans (body). No Inter/Geist.
- **Design tokens (exact):** bg `#0A0C10`, panel `#12161F`, panel-2 `#171C26`, border `#1E2530`, text `#E6EAF0`, muted `#8A94A6`, accent (brand) `#2DD4BF`. Risk scale: low `#34D399`, elevated `#F5A623`, high `#FB7185`, critical `#EF4444`. Sharp radii (2–4px). No emoji icons, no gradient blobs, no bubbly cards.
- **Consent is server-enforced:** signup MUST reject unless `legalAuthorityConfirmed === true`. Store `consentAt`, `consentByAdminUserId`, and **hashed** IP (`consentIpHash`) — never the raw IP.
- **No credential storage, ever:** the schema has no column to hold a submitted password anywhere; `SUBMITTED` is only an `EmailEvent` type (relevant Phase 2, but the schema is created now).
- **Multi-tenant:** every tenant-owned Prisma query filters on `organizationId` from `req.auth`. Cross-org access returns 404, never leakage.
- **Cookie name:** `sp_token`. httpOnly, `sameSite: "lax"`, `secure` from `COOKIE_SECURE` env, `maxAge` 7 days, `path: "/"`.
- **JWT payload (exact shape):** `{ adminUserId: string; organizationId: string; role: "OWNER" | "ADMIN" }`, `expiresIn: "7d"`.

---

## File map

```
package.json                      root workspaces + scripts
docker-compose.yml                postgres:16 + test-db init
docker/init-test-db.sql           CREATE DATABASE sentryphish_test
.env.example  .env  .env.test     env files (.env, .env.test gitignored)
railway.json                      Railway deploy config
README.md                         incl. Responsible Use / GDPR
server/
  package.json  tsconfig.json  vitest.config.ts
  prisma/schema.prisma  prisma/seed.ts
  src/
    index.ts          listen()
    app.ts            createApp() -> express app (no listen)
    env.ts            zod-validated env
    prisma.ts         PrismaClient singleton
    middleware/{auth.ts, errorHandler.ts}
    lib/{password.ts, jwt.ts, hash.ts, asyncHandler.ts, slug.ts, cookie.ts}
    modules/
      auth/{auth.schema.ts, auth.service.ts, auth.routes.ts}
      employees/{employees.schema.ts, employees.service.ts, employees.routes.ts}
  test/{load-env.ts, global-setup.ts, setup.ts, helpers.ts,
        health.test.ts, auth.test.ts, employees.test.ts}
client/
  package.json  index.html  vite.config.ts  tailwind.config.ts
  postcss.config.js  tsconfig.json
  src/
    main.tsx  App.tsx  router.tsx
    styles/{tokens.css, globals.css}
    lib/{api.ts, auth.tsx}
    components/ui/{Button.tsx, Field.tsx, Panel.tsx, Stat.tsx}
    pages/{Landing.tsx, Signup.tsx, Login.tsx, Dashboard.tsx, Employees.tsx}
```

---

## Task 1: Monorepo scaffold + Express health endpoint

**Files:**
- Create: `package.json`, `docker-compose.yml`, `docker/init-test-db.sql`, `.env.example`, `.env`, `.env.test`
- Create: `server/package.json`, `server/tsconfig.json`, `server/vitest.config.ts`
- Create: `server/src/env.ts`, `server/src/app.ts`, `server/src/index.ts`
- Create: `server/test/load-env.ts`, `server/test/global-setup.ts`, `server/test/setup.ts`, `server/test/helpers.ts`, `server/test/health.test.ts`

**Interfaces:**
- Produces: `createApp(): express.Express` (from `server/src/app.ts`); `env` object (from `server/src/env.ts`); test helpers `resetDb(prisma)`.

- [ ] **Step 1: Root workspace + Docker + env files**

`package.json`:
```json
{
  "name": "sentryphish",
  "private": true,
  "workspaces": ["server", "client"],
  "scripts": {
    "dev": "concurrently -n server,client -c cyan,magenta \"npm:dev:server\" \"npm:dev:client\"",
    "dev:server": "npm run dev -w server",
    "dev:client": "npm run dev -w client",
    "build": "npm run build -w server && npm run build -w client",
    "db:migrate": "npm run db:migrate -w server",
    "db:seed": "npm run db:seed -w server",
    "test": "npm run test -w server"
  },
  "devDependencies": { "concurrently": "^9.1.0" }
}
```

`docker-compose.yml`:
```yaml
services:
  db:
    image: postgres:16
    environment:
      POSTGRES_USER: sentryphish
      POSTGRES_PASSWORD: sentryphish
      POSTGRES_DB: sentryphish
    ports: ["5432:5432"]
    volumes:
      - sentryphish_pgdata:/var/lib/postgresql/data
      - ./docker/init-test-db.sql:/docker-entrypoint-initdb.d/init-test-db.sql:ro
volumes:
  sentryphish_pgdata:
```

`docker/init-test-db.sql`:
```sql
CREATE DATABASE sentryphish_test;
```

`.env.example` (copy to `.env`):
```
DATABASE_URL="postgresql://sentryphish:sentryphish@localhost:5432/sentryphish?schema=public"
JWT_SECRET="change-me-to-a-long-random-string-at-least-16-chars"
NODE_ENV="development"
PORT=4000
CLIENT_ORIGIN="http://localhost:5173"
COOKIE_SECURE="false"
```

`.env.test`:
```
DATABASE_URL="postgresql://sentryphish:sentryphish@localhost:5432/sentryphish_test?schema=public"
JWT_SECRET="test-secret-test-secret-0123456789"
NODE_ENV="test"
PORT=4001
CLIENT_ORIGIN="http://localhost:5173"
COOKIE_SECURE="false"
```

Copy `.env.example` to `.env`: `cp .env.example .env`.

- [ ] **Step 2: Server package.json + tsconfig + vitest config**

`server/package.json`:
```json
{
  "name": "server",
  "private": true,
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc -p tsconfig.json",
    "start": "node dist/index.js",
    "db:migrate": "prisma migrate dev",
    "db:migrate:deploy": "prisma migrate deploy",
    "db:seed": "tsx prisma/seed.ts",
    "postinstall": "prisma generate",
    "test": "vitest run"
  },
  "prisma": { "seed": "tsx prisma/seed.ts" },
  "dependencies": {
    "@prisma/client": "^6.1.0",
    "bcryptjs": "^2.4.3",
    "cookie-parser": "^1.4.7",
    "cors": "^2.8.5",
    "csv-parse": "^5.6.0",
    "dotenv": "^16.4.7",
    "express": "^4.21.2",
    "jsonwebtoken": "^9.0.2",
    "multer": "^1.4.5-lts.1",
    "zod": "^3.24.1"
  },
  "devDependencies": {
    "@types/bcryptjs": "^2.4.6",
    "@types/cookie-parser": "^1.4.8",
    "@types/cors": "^2.8.17",
    "@types/express": "^4.17.21",
    "@types/jsonwebtoken": "^9.0.7",
    "@types/multer": "^1.4.12",
    "@types/node": "^22.10.5",
    "@types/supertest": "^6.0.2",
    "prisma": "^6.1.0",
    "supertest": "^7.0.0",
    "tsx": "^4.19.2",
    "typescript": "^5.7.2",
    "vitest": "^2.1.8"
  }
}
```

`server/tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",
    "moduleResolution": "node",
    "esModuleInterop": true,
    "forceConsistentCasingInFileNames": true,
    "strict": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "outDir": "dist",
    "rootDir": "src",
    "types": ["node"]
  },
  "include": ["src"]
}
```

`server/vitest.config.ts`:
```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    globalSetup: ["./test/global-setup.ts"],
    setupFiles: ["./test/load-env.ts", "./test/setup.ts"],
    fileParallelism: false,
    pool: "forks",
    poolOptions: { forks: { singleFork: true } },
  },
});
```

- [ ] **Step 3: env, app, index, and test harness**

`server/src/env.ts`:
```ts
import { z } from "zod";

const schema = z.object({
  DATABASE_URL: z.string().url(),
  JWT_SECRET: z.string().min(16),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().default(4000),
  CLIENT_ORIGIN: z.string().url().default("http://localhost:5173"),
  COOKIE_SECURE: z.enum(["true", "false"]).default("false").transform((v) => v === "true"),
});

export const env = schema.parse(process.env);
```

`server/src/app.ts`:
```ts
import express from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
import { env } from "./env";
import { errorHandler } from "./middleware/errorHandler";

export function createApp() {
  const app = express();
  app.set("trust proxy", true);
  app.use(cors({ origin: env.CLIENT_ORIGIN, credentials: true }));
  app.use(express.json());
  app.use(cookieParser());

  app.get("/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  // Routers are mounted here in later tasks:
  // app.use("/api/auth", authRouter);
  // app.use("/api/employees", employeesRouter);

  app.use(errorHandler);
  return app;
}
```

`server/src/index.ts`:
```ts
import "dotenv/config";
import { createApp } from "./app";
import { env } from "./env";

createApp().listen(env.PORT, () => {
  console.log(`SentryPhish API listening on :${env.PORT}`);
});
```

`server/src/middleware/errorHandler.ts`:
```ts
import { Request, Response, NextFunction } from "express";
import { ZodError } from "zod";

export class AppError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof ZodError) {
    return res.status(400).json({ error: "Validation failed", details: err.flatten() });
  }
  if (err instanceof AppError) {
    return res.status(err.status).json({ error: err.message });
  }
  console.error(err);
  return res.status(500).json({ error: "Internal server error" });
}
```

`server/test/load-env.ts`:
```ts
import { config } from "dotenv";
config({ path: ".env.test" });
```

`server/test/global-setup.ts`:
```ts
import { config } from "dotenv";
import { execSync } from "node:child_process";

config({ path: ".env.test" });

export default function () {
  execSync("npx prisma db push --skip-generate --accept-data-loss", {
    stdio: "inherit",
    env: { ...process.env },
  });
}
```

`server/test/helpers.ts`:
```ts
import { PrismaClient } from "@prisma/client";

export async function resetDb(prisma: PrismaClient) {
  const rows = await prisma.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
  const list = rows.map((r) => `"public"."${r.tablename}"`).join(", ");
  if (list.length) {
    await prisma.$executeRawUnsafe(`TRUNCATE ${list} RESTART IDENTITY CASCADE;`);
  }
}
```

`server/test/setup.ts`:
```ts
import { beforeEach, afterAll } from "vitest";
import { prisma } from "../src/prisma";
import { resetDb } from "./helpers";

beforeEach(async () => {
  await resetDb(prisma);
});

afterAll(async () => {
  await prisma.$disconnect();
});
```

> Note: `src/prisma.ts` is created in Task 2. `setup.ts` and `helpers.ts` will not compile/run until then, which is fine — the health test in Step 4 does not import prisma, and the suite is first run green in Task 2. To run *only* the health test now, temporarily skip DB reset is unnecessary because `beforeEach` import of prisma fails the whole file; therefore **defer running the suite to Task 2 Step 6**. Write the health test now:

`server/test/health.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import request from "supertest";
import { createApp } from "../src/app";

describe("GET /health", () => {
  it("returns ok", async () => {
    const res = await request(createApp()).get("/health");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: "ok" });
  });
});
```

- [ ] **Step 4: Install and boot**

```bash
docker compose up -d
npm install
```
Expected: install completes; `postinstall` may warn that the Prisma schema is missing — ignore until Task 2.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: monorepo scaffold + express health endpoint"
```

---

## Task 2: Prisma schema, migration, client singleton

**Files:**
- Create: `server/prisma/schema.prisma`, `server/prisma/seed.ts`, `server/src/prisma.ts`
- Test: `server/test/health.test.ts` (run full suite green)

**Interfaces:**
- Produces: `prisma` (PrismaClient singleton from `server/src/prisma.ts`); the generated `@prisma/client` types for all models in §4 of the design spec.

- [ ] **Step 1: Write `schema.prisma`** — copy the full schema from the design spec `docs/superpowers/specs/2026-06-26-sentryphish-phase1-foundation-design.md` §4 verbatim, prefixed with:

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```
Then paste all `enum` and `model` blocks exactly as written in the spec (Organization, AdminUser, Employee, PhishingTemplate, Campaign, CampaignRecipient, EmailEvent, TrainingModule, TrainingCompletion, RiskScore, SmtpConfig).

- [ ] **Step 2: Prisma client singleton**

`server/src/prisma.ts`:
```ts
import { PrismaClient } from "@prisma/client";

export const prisma = new PrismaClient();
```

- [ ] **Step 3: Seed stub** (real seed data lands in Phase 2)

`server/prisma/seed.ts`:
```ts
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // Phase 2 will seed system phishing templates and training modules here.
  console.log("Seed complete (no system data in Phase 1).");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
```

- [ ] **Step 4: Generate client + create the dev migration**

```bash
npm run db:migrate -w server -- --name init
```
Expected: Prisma creates `prisma/migrations/<ts>_init/`, applies it to the dev DB, and generates the client. (`--` forwards `--name init` to `prisma migrate dev`.)

- [ ] **Step 5: Add a connectivity test**

Append to `server/test/health.test.ts`:
```ts
import { prisma } from "../src/prisma";

describe("database", () => {
  it("connects and starts empty", async () => {
    const count = await prisma.organization.count();
    expect(count).toBe(0);
  });
});
```

- [ ] **Step 6: Run the full suite**

```bash
npm test -w server
```
Expected: PASS — health (2 assertions) and database connectivity. The global setup runs `prisma db push` against `sentryphish_test`; `beforeEach` truncates.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: full prisma schema, migration, and client singleton"
```

---

## Task 3: Core libs (password, jwt, hash, slug, cookie, asyncHandler)

**Files:**
- Create: `server/src/lib/password.ts`, `server/src/lib/jwt.ts`, `server/src/lib/hash.ts`, `server/src/lib/slug.ts`, `server/src/lib/cookie.ts`, `server/src/lib/asyncHandler.ts`
- Test: `server/test/lib.test.ts`

**Interfaces:**
- Produces:
  - `hashPassword(plain: string): Promise<string>`, `verifyPassword(plain, hash): Promise<boolean>`
  - `signAuthToken(p: AuthTokenPayload): string`, `verifyAuthToken(t: string): AuthTokenPayload`, `interface AuthTokenPayload { adminUserId: string; organizationId: string; role: "OWNER" | "ADMIN" }`
  - `hashIp(ip: string): string`
  - `slugify(name: string): string`, `uniqueSlug(name: string): Promise<string>`
  - `setAuthCookie(res, token)`, `clearAuthCookie(res)`, `COOKIE_NAME = "sp_token"`
  - `asyncHandler(fn)`

- [ ] **Step 1: Write the failing test**

`server/test/lib.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { hashPassword, verifyPassword } from "../src/lib/password";
import { signAuthToken, verifyAuthToken } from "../src/lib/jwt";
import { hashIp } from "../src/lib/hash";
import { slugify } from "../src/lib/slug";

describe("password", () => {
  it("hashes and verifies", async () => {
    const hash = await hashPassword("hunter2pass");
    expect(hash).not.toBe("hunter2pass");
    expect(await verifyPassword("hunter2pass", hash)).toBe(true);
    expect(await verifyPassword("wrong", hash)).toBe(false);
  });
});

describe("jwt", () => {
  it("round-trips the payload", () => {
    const token = signAuthToken({ adminUserId: "a1", organizationId: "o1", role: "OWNER" });
    const decoded = verifyAuthToken(token);
    expect(decoded.adminUserId).toBe("a1");
    expect(decoded.organizationId).toBe("o1");
    expect(decoded.role).toBe("OWNER");
  });
  it("rejects a tampered token", () => {
    expect(() => verifyAuthToken("not.a.token")).toThrow();
  });
});

describe("hashIp", () => {
  it("is deterministic and not the raw ip", () => {
    expect(hashIp("1.2.3.4")).toBe(hashIp("1.2.3.4"));
    expect(hashIp("1.2.3.4")).not.toContain("1.2.3.4");
  });
});

describe("slugify", () => {
  it("kebab-cases and strips punctuation", () => {
    expect(slugify("Acme Clinic AB!")).toBe("acme-clinic-ab");
  });
});
```

- [ ] **Step 2: Run to verify it fails**

```bash
npm test -w server -- lib.test.ts
```
Expected: FAIL (modules not found).

- [ ] **Step 3: Implement the libs**

`server/src/lib/password.ts`:
```ts
import bcrypt from "bcryptjs";
export const hashPassword = (plain: string) => bcrypt.hash(plain, 10);
export const verifyPassword = (plain: string, hash: string) => bcrypt.compare(plain, hash);
```

`server/src/lib/jwt.ts`:
```ts
import jwt from "jsonwebtoken";
import { env } from "../env";

export interface AuthTokenPayload {
  adminUserId: string;
  organizationId: string;
  role: "OWNER" | "ADMIN";
}

export const signAuthToken = (p: AuthTokenPayload) =>
  jwt.sign(p, env.JWT_SECRET, { expiresIn: "7d" });

export const verifyAuthToken = (token: string): AuthTokenPayload =>
  jwt.verify(token, env.JWT_SECRET) as AuthTokenPayload;
```

`server/src/lib/hash.ts`:
```ts
import { createHash } from "node:crypto";
export const hashIp = (ip: string) => createHash("sha256").update(ip).digest("hex");
```

`server/src/lib/slug.ts`:
```ts
import { prisma } from "../prisma";

export const slugify = (name: string) =>
  name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

export async function uniqueSlug(name: string): Promise<string> {
  const base = slugify(name) || "org";
  let candidate = base;
  let n = 1;
  while (await prisma.organization.findUnique({ where: { slug: candidate } })) {
    candidate = `${base}-${n++}`;
  }
  return candidate;
}
```

`server/src/lib/cookie.ts`:
```ts
import { Response } from "express";
import { env } from "../env";

export const COOKIE_NAME = "sp_token";

const base = {
  httpOnly: true as const,
  sameSite: "lax" as const,
  secure: env.COOKIE_SECURE,
  path: "/",
};

export function setAuthCookie(res: Response, token: string) {
  res.cookie(COOKIE_NAME, token, { ...base, maxAge: 7 * 24 * 60 * 60 * 1000 });
}

export function clearAuthCookie(res: Response) {
  res.clearCookie(COOKIE_NAME, base);
}
```

`server/src/lib/asyncHandler.ts`:
```ts
import { Request, Response, NextFunction, RequestHandler } from "express";

export const asyncHandler =
  (fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>): RequestHandler =>
  (req, res, next) =>
    Promise.resolve(fn(req, res, next)).catch(next);
```

- [ ] **Step 4: Run to verify pass**

```bash
npm test -w server -- lib.test.ts
```
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: core libs (password, jwt, ip-hash, slug, cookie, asyncHandler)"
```

---

## Task 4: Auth middleware + auth endpoints (signup/login/logout/me)

**Files:**
- Create: `server/src/middleware/auth.ts`, `server/src/modules/auth/auth.schema.ts`, `server/src/modules/auth/auth.service.ts`, `server/src/modules/auth/auth.routes.ts`
- Modify: `server/src/app.ts` (mount `authRouter`)
- Test: `server/test/auth.test.ts`

**Interfaces:**
- Consumes: libs from Task 3; `prisma`.
- Produces:
  - `requireAuth` middleware setting `req.auth: AuthTokenPayload`.
  - `authRouter` mounted at `/api/auth` with: `POST /signup`, `POST /login`, `POST /logout`, `GET /me`.
  - `signupService(input, ipHash)`, `publicUser(admin)`, `publicOrg(org)`.

- [ ] **Step 1: Write the failing test**

`server/test/auth.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import request from "supertest";
import { createApp } from "../src/app";

const app = createApp();

const goodSignup = {
  name: "Owner One",
  orgName: "Acme Clinic",
  email: "owner@acme.test",
  password: "hunter2pass",
  legalAuthorityConfirmed: true,
};

describe("POST /api/auth/signup", () => {
  it("rejects when consent is not confirmed", async () => {
    const res = await request(app)
      .post("/api/auth/signup")
      .send({ ...goodSignup, legalAuthorityConfirmed: false });
    expect(res.status).toBe(400);
  });

  it("creates org + owner, stamps consent, sets cookie", async () => {
    const res = await request(app).post("/api/auth/signup").send(goodSignup);
    expect(res.status).toBe(201);
    expect(res.body.user.email).toBe("owner@acme.test");
    expect(res.body.organization.name).toBe("Acme Clinic");
    expect(res.body.user.passwordHash).toBeUndefined();
    const cookie = res.headers["set-cookie"]?.[0] ?? "";
    expect(cookie).toContain("sp_token=");
    expect(cookie).toContain("HttpOnly");
  });

  it("rejects a duplicate email", async () => {
    await request(app).post("/api/auth/signup").send(goodSignup);
    const res = await request(app).post("/api/auth/signup").send(goodSignup);
    expect(res.status).toBe(409);
  });
});

describe("login / me / logout", () => {
  it("logs in and reads the session", async () => {
    const agent = request.agent(app);
    await agent.post("/api/auth/signup").send(goodSignup);
    const me = await agent.get("/api/auth/me");
    expect(me.status).toBe(200);
    expect(me.body.user.email).toBe("owner@acme.test");
  });

  it("rejects /me without a cookie", async () => {
    const res = await request(app).get("/api/auth/me");
    expect(res.status).toBe(401);
  });

  it("rejects wrong password", async () => {
    await request(app).post("/api/auth/signup").send(goodSignup);
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: goodSignup.email, password: "wrongpass1" });
    expect(res.status).toBe(401);
  });

  it("logout clears the cookie", async () => {
    const agent = request.agent(app);
    await agent.post("/api/auth/signup").send(goodSignup);
    await agent.post("/api/auth/logout");
    const me = await agent.get("/api/auth/me");
    expect(me.status).toBe(401);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

```bash
npm test -w server -- auth.test.ts
```
Expected: FAIL (route not mounted / 404).

- [ ] **Step 3: Implement middleware**

`server/src/middleware/auth.ts`:
```ts
import { Request, Response, NextFunction } from "express";
import { verifyAuthToken, AuthTokenPayload } from "../lib/jwt";
import { COOKIE_NAME } from "../lib/cookie";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      auth?: AuthTokenPayload;
    }
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const token = req.cookies?.[COOKIE_NAME];
  if (!token) return res.status(401).json({ error: "Not authenticated" });
  try {
    req.auth = verifyAuthToken(token);
    next();
  } catch {
    return res.status(401).json({ error: "Invalid session" });
  }
}
```

- [ ] **Step 4: Implement schema + service**

`server/src/modules/auth/auth.schema.ts`:
```ts
import { z } from "zod";

export const signupSchema = z.object({
  name: z.string().min(1),
  orgName: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(8),
  legalAuthorityConfirmed: z.literal(true, {
    errorMap: () => ({ message: "You must confirm you have legal authority to run simulations." }),
  }),
});
export type SignupInput = z.infer<typeof signupSchema>;

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});
```

`server/src/modules/auth/auth.service.ts`:
```ts
import { prisma } from "../../prisma";
import { AppError } from "../../middleware/errorHandler";
import { hashPassword } from "../../lib/password";
import { uniqueSlug } from "../../lib/slug";
import { SignupInput } from "./auth.schema";
import type { AdminUser, Organization } from "@prisma/client";

export async function signupService(input: SignupInput, ipHash: string) {
  const existing = await prisma.adminUser.findUnique({ where: { email: input.email } });
  if (existing) throw new AppError(409, "Email already registered");

  const slug = await uniqueSlug(input.orgName);
  const passwordHash = await hashPassword(input.password);

  return prisma.$transaction(async (tx) => {
    const org = await tx.organization.create({
      data: {
        name: input.orgName,
        slug,
        legalAuthorityConfirmed: true,
        consentAt: new Date(),
        consentIpHash: ipHash,
      },
    });
    const admin = await tx.adminUser.create({
      data: {
        organizationId: org.id,
        email: input.email,
        name: input.name,
        passwordHash,
        role: "OWNER",
      },
    });
    const orgWithConsent = await tx.organization.update({
      where: { id: org.id },
      data: { consentByAdminUserId: admin.id },
    });
    return { org: orgWithConsent, admin };
  });
}

export const publicUser = (a: AdminUser) => ({
  id: a.id,
  name: a.name,
  email: a.email,
  role: a.role,
  organizationId: a.organizationId,
});

export const publicOrg = (o: Organization) => ({
  id: o.id,
  name: o.name,
  slug: o.slug,
});
```

- [ ] **Step 5: Implement routes**

`server/src/modules/auth/auth.routes.ts`:
```ts
import { Router } from "express";
import { prisma } from "../../prisma";
import { asyncHandler } from "../../lib/asyncHandler";
import { AppError } from "../../middleware/errorHandler";
import { hashIp } from "../../lib/hash";
import { verifyPassword } from "../../lib/password";
import { signAuthToken } from "../../lib/jwt";
import { setAuthCookie, clearAuthCookie } from "../../lib/cookie";
import { requireAuth } from "../../middleware/auth";
import { signupSchema, loginSchema } from "./auth.schema";
import { signupService, publicUser, publicOrg } from "./auth.service";

export const authRouter = Router();

authRouter.post(
  "/signup",
  asyncHandler(async (req, res) => {
    const input = signupSchema.parse(req.body);
    const ipHash = hashIp(req.ip ?? "unknown");
    const { admin, org } = await signupService(input, ipHash);
    setAuthCookie(res, signAuthToken({ adminUserId: admin.id, organizationId: org.id, role: admin.role }));
    res.status(201).json({ user: publicUser(admin), organization: publicOrg(org) });
  })
);

authRouter.post(
  "/login",
  asyncHandler(async (req, res) => {
    const { email, password } = loginSchema.parse(req.body);
    const admin = await prisma.adminUser.findUnique({
      where: { email },
      include: { organization: true },
    });
    if (!admin || !(await verifyPassword(password, admin.passwordHash))) {
      throw new AppError(401, "Invalid credentials");
    }
    setAuthCookie(
      res,
      signAuthToken({ adminUserId: admin.id, organizationId: admin.organizationId, role: admin.role })
    );
    res.json({ user: publicUser(admin), organization: publicOrg(admin.organization) });
  })
);

authRouter.post("/logout", (_req, res) => {
  clearAuthCookie(res);
  res.json({ ok: true });
});

authRouter.get(
  "/me",
  requireAuth,
  asyncHandler(async (req, res) => {
    const admin = await prisma.adminUser.findUnique({
      where: { id: req.auth!.adminUserId },
      include: { organization: true },
    });
    if (!admin) throw new AppError(401, "Session user not found");
    res.json({ user: publicUser(admin), organization: publicOrg(admin.organization) });
  })
);
```

- [ ] **Step 6: Mount the router in `app.ts`**

In `server/src/app.ts`, add the import and replace the auth comment line:
```ts
import { authRouter } from "./modules/auth/auth.routes";
```
```ts
  app.use("/api/auth", authRouter);
```

- [ ] **Step 7: Run to verify pass**

```bash
npm test -w server -- auth.test.ts
```
Expected: PASS (all auth cases).

- [ ] **Step 8: Commit**

```bash
git add -A && git commit -m "feat: auth (signup w/ consent, login, logout, me) + auth middleware"
```

---

## Task 5: Employees — service, routes, CSV import, cross-org isolation

**Files:**
- Create: `server/src/modules/employees/employees.schema.ts`, `server/src/modules/employees/employees.service.ts`, `server/src/modules/employees/employees.routes.ts`
- Modify: `server/src/app.ts` (mount `employeesRouter`)
- Test: `server/test/employees.test.ts`

**Interfaces:**
- Consumes: `requireAuth`, `prisma`, `asyncHandler`, `AppError`.
- Produces: `employeesRouter` at `/api/employees`: `GET /`, `POST /` (single add), `POST /import` (multipart `file`), `PATCH /:id/deactivate`. Service: `listEmployees(orgId)`, `createEmployee(orgId, input)`, `deactivateEmployee(orgId, id)`, `importCsv(orgId, csv: string)` → `{ created, updated, skipped, errors: { row: number; reason: string }[] }`.

- [ ] **Step 1: Write the failing test**

`server/test/employees.test.ts`:
```ts
import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import { createApp } from "../src/app";

const app = createApp();

async function signupAgent(email: string, orgName: string) {
  const agent = request.agent(app);
  await agent.post("/api/auth/signup").send({
    name: "Owner",
    orgName,
    email,
    password: "hunter2pass",
    legalAuthorityConfirmed: true,
  });
  return agent;
}

describe("employees", () => {
  it("imports a CSV, dedupes within the org, reports a summary", async () => {
    const agent = await signupAgent("a@acme.test", "Acme");
    const csv = [
      "name,email,department",
      "Anna Berg,anna@acme.test,Reception",
      "Bo Lind,bo@acme.test,IT",
      "Anna Berg,anna@acme.test,Reception", // duplicate -> update, not new
      "broken-row-no-email,,Ops",           // invalid -> error
    ].join("\n");

    const res = await agent
      .post("/api/employees/import")
      .attach("file", Buffer.from(csv), "employees.csv");

    expect(res.status).toBe(200);
    expect(res.body.created).toBe(2);
    expect(res.body.updated).toBe(1);
    expect(res.body.errors.length).toBe(1);

    const list = await agent.get("/api/employees");
    expect(list.body.employees.length).toBe(2);
  });

  it("adds and deactivates a single employee", async () => {
    const agent = await signupAgent("b@acme.test", "Acme2");
    const created = await agent
      .post("/api/employees")
      .send({ name: "Cara Nyman", email: "cara@acme.test", department: "HR" });
    expect(created.status).toBe(201);
    const id = created.body.employee.id;

    const off = await agent.patch(`/api/employees/${id}/deactivate`);
    expect(off.status).toBe(200);
    expect(off.body.employee.active).toBe(false);
  });

  it("isolates employees between orgs", async () => {
    const orgA = await signupAgent("owner@a.test", "OrgA");
    const orgB = await signupAgent("owner@b.test", "OrgB");

    const made = await orgA
      .post("/api/employees")
      .send({ name: "Secret Staff", email: "secret@a.test", department: "Exec" });
    const aId = made.body.employee.id;

    // Org B cannot see Org A's employees
    const bList = await orgB.get("/api/employees");
    expect(bList.body.employees.length).toBe(0);

    // Org B cannot deactivate Org A's employee
    const cross = await orgB.patch(`/api/employees/${aId}/deactivate`);
    expect(cross.status).toBe(404);

    // And the employee in Org A is untouched
    const aList = await orgA.get("/api/employees");
    expect(aList.body.employees[0].active).toBe(true);
  });

  it("requires authentication", async () => {
    const res = await request(app).get("/api/employees");
    expect(res.status).toBe(401);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

```bash
npm test -w server -- employees.test.ts
```
Expected: FAIL (routes not mounted).

- [ ] **Step 3: Implement schema**

`server/src/modules/employees/employees.schema.ts`:
```ts
import { z } from "zod";

export const employeeInputSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  department: z.string().optional().nullable(),
});
export type EmployeeInput = z.infer<typeof employeeInputSchema>;
```

- [ ] **Step 4: Implement service**

`server/src/modules/employees/employees.service.ts`:
```ts
import { parse } from "csv-parse/sync";
import { prisma } from "../../prisma";
import { AppError } from "../../middleware/errorHandler";
import { employeeInputSchema, EmployeeInput } from "./employees.schema";

export function listEmployees(organizationId: string) {
  return prisma.employee.findMany({
    where: { organizationId },
    orderBy: { createdAt: "desc" },
  });
}

export function createEmployee(organizationId: string, input: EmployeeInput) {
  return prisma.employee.upsert({
    where: { organizationId_email: { organizationId, email: input.email } },
    update: { name: input.name, department: input.department ?? null },
    create: {
      organizationId,
      name: input.name,
      email: input.email,
      department: input.department ?? null,
    },
  });
}

export async function deactivateEmployee(organizationId: string, id: string) {
  const employee = await prisma.employee.findFirst({ where: { id, organizationId } });
  if (!employee) throw new AppError(404, "Employee not found");
  return prisma.employee.update({ where: { id }, data: { active: false } });
}

export interface ImportSummary {
  created: number;
  updated: number;
  skipped: number;
  errors: { row: number; reason: string }[];
}

export async function importCsv(organizationId: string, csv: string): Promise<ImportSummary> {
  let records: Record<string, string>[];
  try {
    records = parse(csv, { columns: true, skip_empty_lines: true, trim: true });
  } catch {
    throw new AppError(400, "Could not parse CSV");
  }

  const summary: ImportSummary = { created: 0, updated: 0, skipped: 0, errors: [] };

  for (let i = 0; i < records.length; i++) {
    const parsed = employeeInputSchema.safeParse({
      name: records[i].name,
      email: records[i].email,
      department: records[i].department,
    });
    if (!parsed.success) {
      summary.skipped++;
      summary.errors.push({ row: i + 2, reason: "Invalid name or email" }); // +2: header + 1-based
      continue;
    }
    const exists = await prisma.employee.findUnique({
      where: { organizationId_email: { organizationId, email: parsed.data.email } },
    });
    await createEmployee(organizationId, parsed.data);
    if (exists) summary.updated++;
    else summary.created++;
  }
  return summary;
}
```

- [ ] **Step 5: Implement routes**

`server/src/modules/employees/employees.routes.ts`:
```ts
import { Router } from "express";
import multer from "multer";
import { asyncHandler } from "../../lib/asyncHandler";
import { AppError } from "../../middleware/errorHandler";
import { requireAuth } from "../../middleware/auth";
import { employeeInputSchema } from "./employees.schema";
import {
  listEmployees,
  createEmployee,
  deactivateEmployee,
  importCsv,
} from "./employees.service";

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 1024 * 1024 } });

export const employeesRouter = Router();
employeesRouter.use(requireAuth);

employeesRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const employees = await listEmployees(req.auth!.organizationId);
    res.json({ employees });
  })
);

employeesRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const input = employeeInputSchema.parse(req.body);
    const employee = await createEmployee(req.auth!.organizationId, input);
    res.status(201).json({ employee });
  })
);

employeesRouter.post(
  "/import",
  upload.single("file"),
  asyncHandler(async (req, res) => {
    if (!req.file) throw new AppError(400, "No file uploaded (field name must be 'file')");
    const summary = await importCsv(req.auth!.organizationId, req.file.buffer.toString("utf8"));
    res.json(summary);
  })
);

employeesRouter.patch(
  "/:id/deactivate",
  asyncHandler(async (req, res) => {
    const employee = await deactivateEmployee(req.auth!.organizationId, req.params.id);
    res.json({ employee });
  })
);
```

- [ ] **Step 6: Mount the router in `app.ts`**

In `server/src/app.ts`, add:
```ts
import { employeesRouter } from "./modules/employees/employees.routes";
```
```ts
  app.use("/api/employees", employeesRouter);
```

- [ ] **Step 7: Run the full suite**

```bash
npm test -w server
```
Expected: PASS — health, db, lib, auth, employees (incl. cross-org isolation).

- [ ] **Step 8: Commit**

```bash
git add -A && git commit -m "feat: employees module (CSV import, CRUD, cross-org isolation)"
```

---

## Task 6: Client scaffold — Vite + Tailwind + design tokens + UI primitives

**Files:**
- Create: `client/package.json`, `client/index.html`, `client/vite.config.ts`, `client/tsconfig.json`, `client/tailwind.config.ts`, `client/postcss.config.js`
- Create: `client/src/main.tsx`, `client/src/App.tsx`
- Create: `client/src/styles/tokens.css`, `client/src/styles/globals.css`
- Create: `client/src/components/ui/{Panel,Button,Field,Stat}.tsx`

**Interfaces:**
- Produces: design tokens as CSS variables + Tailwind theme; `Panel`, `Button`, `Field`, `Stat` components.

- [ ] **Step 1: Client package.json + config**

`client/package.json`:
```json
{
  "name": "client",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "react-router-dom": "^6.28.0"
  },
  "devDependencies": {
    "@types/react": "^18.3.18",
    "@types/react-dom": "^18.3.5",
    "@vitejs/plugin-react": "^4.3.4",
    "autoprefixer": "^10.4.20",
    "postcss": "^8.4.49",
    "tailwindcss": "^3.4.17",
    "typescript": "^5.7.2",
    "vite": "^6.0.7"
  }
}
```

`client/vite.config.ts`:
```ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: { port: 5173 },
});
```

`client/tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "jsx": "react-jsx",
    "strict": true,
    "skipLibCheck": true,
    "noEmit": true,
    "esModuleInterop": true,
    "types": ["vite/client"]
  },
  "include": ["src"]
}
```

`client/postcss.config.js`:
```js
export default { plugins: { tailwindcss: {}, autoprefixer: {} } };
```

`client/index.html`:
```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>SentryPhish — TryggNät Säkerhet</title>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link
      href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&family=IBM+Plex+Sans:wght@400;500;600;700&display=swap"
      rel="stylesheet"
    />
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 2: Tailwind config + tokens**

`client/tailwind.config.ts`:
```ts
import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "var(--bg)",
        panel: "var(--panel)",
        "panel-2": "var(--panel-2)",
        border: "var(--border)",
        text: "var(--text)",
        muted: "var(--muted)",
        accent: "var(--accent)",
        risk: {
          low: "var(--risk-low)",
          elevated: "var(--risk-elevated)",
          high: "var(--risk-high)",
          critical: "var(--risk-critical)",
        },
      },
      fontFamily: {
        sans: ["IBM Plex Sans", "system-ui", "sans-serif"],
        mono: ["IBM Plex Mono", "ui-monospace", "monospace"],
      },
      borderRadius: { DEFAULT: "3px", sm: "2px", md: "4px" },
    },
  },
  plugins: [],
} satisfies Config;
```

`client/src/styles/tokens.css`:
```css
:root {
  --bg: #0a0c10;
  --panel: #12161f;
  --panel-2: #171c26;
  --border: #1e2530;
  --text: #e6eaf0;
  --muted: #8a94a6;
  --accent: #2dd4bf;
  --risk-low: #34d399;
  --risk-elevated: #f5a623;
  --risk-high: #fb7185;
  --risk-critical: #ef4444;
}
```

`client/src/styles/globals.css`:
```css
@import "./tokens.css";
@tailwind base;
@tailwind components;
@tailwind utilities;

html, body, #root { height: 100%; }
body {
  margin: 0;
  background: var(--bg);
  color: var(--text);
  font-family: "IBM Plex Sans", system-ui, sans-serif;
  -webkit-font-smoothing: antialiased;
}

/* faint SOC grid texture */
.soc-grid {
  background-image:
    linear-gradient(var(--border) 1px, transparent 1px),
    linear-gradient(90deg, var(--border) 1px, transparent 1px);
  background-size: 40px 40px;
  background-position: -1px -1px;
  opacity: 0.25;
}
```

- [ ] **Step 3: UI primitives**

`client/src/components/ui/Panel.tsx`:
```tsx
import { ReactNode } from "react";

export function Panel({ title, children, className = "" }: { title?: string; children: ReactNode; className?: string }) {
  return (
    <section className={`border border-border bg-panel rounded ${className}`}>
      {title && (
        <header className="border-b border-border px-4 py-2 text-xs uppercase tracking-widest text-muted font-mono">
          {title}
        </header>
      )}
      <div className="p-4">{children}</div>
    </section>
  );
}
```

`client/src/components/ui/Button.tsx`:
```tsx
import { ButtonHTMLAttributes } from "react";

export function Button({ className = "", ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={`inline-flex items-center justify-center rounded-sm border border-accent/40 bg-accent/10 px-4 py-2 text-sm font-medium text-accent transition-colors hover:bg-accent/20 disabled:opacity-50 ${className}`}
    />
  );
}
```

`client/src/components/ui/Field.tsx`:
```tsx
import { InputHTMLAttributes } from "react";

export function Field({ label, ...props }: { label: string } & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs uppercase tracking-wider text-muted font-mono">{label}</span>
      <input
        {...props}
        className="w-full rounded-sm border border-border bg-bg px-3 py-2 text-text outline-none focus:border-accent"
      />
    </label>
  );
}
```

`client/src/components/ui/Stat.tsx`:
```tsx
export function Stat({ label, value, tone = "text" }: { label: string; value: string; tone?: "text" | "accent" | "risk-high" }) {
  const color = tone === "accent" ? "text-accent" : tone === "risk-high" ? "text-risk-high" : "text-text";
  return (
    <div className="border border-border bg-panel-2 rounded p-4">
      <div className="text-xs uppercase tracking-widest text-muted font-mono">{label}</div>
      <div className={`mt-1 font-mono text-3xl ${color}`}>{value}</div>
    </div>
  );
}
```

- [ ] **Step 4: main.tsx + temporary App**

`client/src/main.tsx`:
```tsx
import React from "react";
import ReactDOM from "react-dom/client";
import "./styles/globals.css";
import App from "./App";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

`client/src/App.tsx` (temporary; replaced in Task 7):
```tsx
import { Panel } from "./components/ui/Panel";
import { Stat } from "./components/ui/Stat";

export default function App() {
  return (
    <div className="min-h-full p-8">
      <Panel title="System check">
        <Stat label="Status" value="ONLINE" tone="accent" />
      </Panel>
    </div>
  );
}
```

- [ ] **Step 5: Install + boot the client**

```bash
npm install
npm run dev:client
```
Expected: Vite serves on http://localhost:5173 showing a dark panel with "ONLINE" in mono/teal. Stop with Ctrl-C.

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "feat: client scaffold (vite, tailwind, SOC tokens, ui primitives)"
```

---

## Task 7: Client — API client, auth context, router, Signup/Login pages

**Files:**
- Create: `client/src/lib/api.ts`, `client/src/lib/auth.tsx`, `client/src/router.tsx`
- Create: `client/src/pages/{Signup,Login}.tsx`
- Modify: `client/src/App.tsx` (use the router)

**Interfaces:**
- Consumes: backend `/api/auth/*`.
- Produces: `api` (fetch wrapper, `credentials:"include"`); `useAuth()` → `{ user, org, loading, login, signup, logout }`; `<RequireAuth>` route guard.

- [ ] **Step 1: API client**

`client/src/lib/api.ts`:
```ts
const BASE = import.meta.env.VITE_API_URL ?? "http://localhost:4000";

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    credentials: "include",
    headers: { "Content-Type": "application/json", ...(options.headers ?? {}) },
    ...options,
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error ?? `Request failed (${res.status})`);
  return body as T;
}

export const api = {
  get: <T>(p: string) => request<T>(p),
  post: <T>(p: string, data?: unknown) =>
    request<T>(p, { method: "POST", body: data ? JSON.stringify(data) : undefined }),
  patch: <T>(p: string) => request<T>(p, { method: "PATCH" }),
  upload: async <T>(p: string, file: File): Promise<T> => {
    const form = new FormData();
    form.append("file", file);
    const res = await fetch(`${BASE}${p}`, { method: "POST", credentials: "include", body: form });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error ?? `Upload failed (${res.status})`);
    return body as T;
  },
};
```

- [ ] **Step 2: Auth context**

`client/src/lib/auth.tsx`:
```tsx
import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { api } from "./api";

interface User { id: string; name: string; email: string; role: string; organizationId: string; }
interface Org { id: string; name: string; slug: string; }
interface Session { user: User; organization: Org; }

interface AuthState {
  user: User | null;
  org: Org | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (input: SignupInput) => Promise<void>;
  logout: () => Promise<void>;
}
export interface SignupInput {
  name: string; orgName: string; email: string; password: string; legalAuthorityConfirmed: boolean;
}

const Ctx = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [org, setOrg] = useState<Org | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<Session>("/api/auth/me")
      .then((s) => { setUser(s.user); setOrg(s.organization); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const apply = (s: Session) => { setUser(s.user); setOrg(s.organization); };

  const login = async (email: string, password: string) =>
    apply(await api.post<Session>("/api/auth/login", { email, password }));
  const signup = async (input: SignupInput) =>
    apply(await api.post<Session>("/api/auth/signup", input));
  const logout = async () => { await api.post("/api/auth/logout"); setUser(null); setOrg(null); };

  return <Ctx.Provider value={{ user, org, loading, login, signup, logout }}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
```

- [ ] **Step 3: Router + guard**

`client/src/router.tsx`:
```tsx
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ReactNode } from "react";
import { useAuth } from "./lib/auth";
import Landing from "./pages/Landing";
import Signup from "./pages/Signup";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Employees from "./pages/Employees";

function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="p-8 font-mono text-muted">Authenticating…</div>;
  return user ? <>{children}</> : <Navigate to="/login" replace />;
}

export function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/login" element={<Login />} />
        <Route path="/app" element={<RequireAuth><Dashboard /></RequireAuth>} />
        <Route path="/app/employees" element={<RequireAuth><Employees /></RequireAuth>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
```

`client/src/App.tsx` (replace temporary version):
```tsx
import { AuthProvider } from "./lib/auth";
import { AppRouter } from "./router";

export default function App() {
  return (
    <AuthProvider>
      <AppRouter />
    </AuthProvider>
  );
}
```

- [ ] **Step 4: Signup page (with the consent checkbox)**

`client/src/pages/Signup.tsx`:
```tsx
import { FormEvent, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { Panel } from "../components/ui/Panel";
import { Field } from "../components/ui/Field";
import { Button } from "../components/ui/Button";

export default function Signup() {
  const { signup } = useAuth();
  const nav = useNavigate();
  const [form, setForm] = useState({ name: "", orgName: "", email: "", password: "" });
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm({ ...form, [k]: e.target.value });

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await signup({ ...form, legalAuthorityConfirmed: consent });
      nav("/app");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-full grid place-items-center p-6">
      <div className="w-full max-w-md">
        <div className="mb-6 font-mono text-sm tracking-widest text-accent">SENTRYPHISH // PROVISION ORG</div>
        <Panel title="Create organization">
          <form onSubmit={onSubmit} className="space-y-4">
            <Field label="Your name" value={form.name} onChange={set("name")} required />
            <Field label="Organization name" value={form.orgName} onChange={set("orgName")} required />
            <Field label="Email" type="email" value={form.email} onChange={set("email")} required />
            <Field label="Password" type="password" value={form.password} onChange={set("password")} required minLength={8} />
            <label className="flex gap-3 text-sm text-muted">
              <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-1 accent-accent" />
              <span>
                I confirm my organization has the legal authority to run phishing simulations against
                the employees we upload, and that staff will be given appropriate notice per local
                employment law and GDPR.
              </span>
            </label>
            {error && <div className="text-sm text-risk-high font-mono">{error}</div>}
            <Button type="submit" disabled={busy || !consent} className="w-full">
              {busy ? "Provisioning…" : "Create organization"}
            </Button>
          </form>
        </Panel>
        <div className="mt-4 text-center text-sm text-muted">
          Already have an account? <Link to="/login" className="text-accent">Sign in</Link>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Login page**

`client/src/pages/Login.tsx`:
```tsx
import { FormEvent, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { Panel } from "../components/ui/Panel";
import { Field } from "../components/ui/Field";
import { Button } from "../components/ui/Button";

export default function Login() {
  const { login } = useAuth();
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await login(email, password);
      nav("/app");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-full grid place-items-center p-6">
      <div className="w-full max-w-md">
        <div className="mb-6 font-mono text-sm tracking-widest text-accent">SENTRYPHISH // ACCESS</div>
        <Panel title="Sign in">
          <form onSubmit={onSubmit} className="space-y-4">
            <Field label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            <Field label="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            {error && <div className="text-sm text-risk-high font-mono">{error}</div>}
            <Button type="submit" disabled={busy} className="w-full">{busy ? "Authenticating…" : "Sign in"}</Button>
          </form>
        </Panel>
        <div className="mt-4 text-center text-sm text-muted">
          No account? <Link to="/signup" className="text-accent">Provision an organization</Link>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 6: Manual verification**

With `docker compose up -d` and `npm run dev` (both services) running: visit `/signup`, try submitting with the consent box unchecked (button disabled), check it, submit → lands on `/app` (Dashboard, built next task — temporarily it may 404 until Task 8; acceptable). Confirm in DevTools that an `sp_token` HttpOnly cookie was set.

- [ ] **Step 7: Commit**

```bash
git add -A && git commit -m "feat: client auth (api client, context, router, signup w/ consent, login)"
```

---

## Task 8: Client — Dashboard shell, Employees page, Landing page

**Files:**
- Create: `client/src/pages/{Dashboard,Employees,Landing}.tsx`

**Interfaces:**
- Consumes: `useAuth()`, `api`, UI primitives.
- Produces: the three pages referenced by `router.tsx` (Task 7). (Router already imports them; creating the files completes the build.)

- [ ] **Step 1: Dashboard shell**

`client/src/pages/Dashboard.tsx`:
```tsx
import { Link } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { Panel } from "../components/ui/Panel";
import { Stat } from "../components/ui/Stat";
import { Button } from "../components/ui/Button";

export default function Dashboard() {
  const { user, org, logout } = useAuth();
  return (
    <div className="min-h-full">
      <header className="flex items-center justify-between border-b border-border px-6 py-3">
        <div className="font-mono text-sm tracking-widest text-accent">SENTRYPHISH</div>
        <nav className="flex items-center gap-4 text-sm">
          <Link to="/app" className="text-text">Overview</Link>
          <Link to="/app/employees" className="text-muted hover:text-text">Employees</Link>
          <span className="text-muted">{org?.name}</span>
          <Button onClick={() => logout()} className="px-3 py-1">Sign out</Button>
        </nav>
      </header>
      <main className="p-6 space-y-6">
        <div className="text-sm text-muted font-mono">OPERATOR // {user?.email}</div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Stat label="Org risk score" value="—" tone="accent" />
          <Stat label="Active campaigns" value="0" />
          <Stat label="Employees enrolled" value="0" />
        </div>
        <Panel title="Getting started">
          <ol className="list-decimal pl-5 text-sm text-muted space-y-1">
            <li>Upload your employee roster (CSV) on the <Link to="/app/employees" className="text-accent">Employees</Link> page.</li>
            <li>Campaign engine, risk scoring, and training arrive in the next phases.</li>
          </ol>
        </Panel>
      </main>
    </div>
  );
}
```

- [ ] **Step 2: Employees page (upload + list)**

`client/src/pages/Employees.tsx`:
```tsx
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import { Panel } from "../components/ui/Panel";
import { Button } from "../components/ui/Button";

interface Employee { id: string; name: string; email: string; department: string | null; active: boolean; }
interface ImportSummary { created: number; updated: number; skipped: number; errors: { row: number; reason: string }[]; }

export default function Employees() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = () => api.get<{ employees: Employee[] }>("/api/employees").then((r) => setEmployees(r.employees));
  useEffect(() => { load(); }, []);

  async function onUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    try {
      const result = await api.upload<ImportSummary>("/api/employees/import", file);
      setSummary(result);
      await load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function deactivate(id: string) {
    await api.patch(`/api/employees/${id}/deactivate`);
    await load();
  }

  return (
    <div className="min-h-full">
      <header className="flex items-center justify-between border-b border-border px-6 py-3">
        <div className="font-mono text-sm tracking-widest text-accent">SENTRYPHISH</div>
        <nav className="flex gap-4 text-sm">
          <Link to="/app" className="text-muted hover:text-text">Overview</Link>
          <Link to="/app/employees" className="text-text">Employees</Link>
        </nav>
      </header>
      <main className="p-6 space-y-6">
        <Panel title="Import roster (CSV: name,email,department)">
          <input ref={fileRef} type="file" accept=".csv" onChange={onUpload} className="text-sm text-muted" />
          {error && <div className="mt-3 text-sm text-risk-high font-mono">{error}</div>}
          {summary && (
            <div className="mt-3 font-mono text-sm text-muted">
              <span className="text-risk-low">{summary.created} created</span> ·{" "}
              <span className="text-accent">{summary.updated} updated</span> ·{" "}
              <span className="text-risk-elevated">{summary.skipped} skipped</span>
              {summary.errors.length > 0 && (
                <ul className="mt-2 list-disc pl-5 text-risk-high">
                  {summary.errors.map((er) => <li key={er.row}>row {er.row}: {er.reason}</li>)}
                </ul>
              )}
            </div>
          )}
        </Panel>

        <Panel title={`Employees (${employees.length})`}>
          <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase tracking-wider text-muted font-mono">
              <tr className="border-b border-border">
                <th className="py-2">Name</th><th>Email</th><th>Department</th><th>Status</th><th></th>
              </tr>
            </thead>
            <tbody className="font-mono">
              {employees.map((emp) => (
                <tr key={emp.id} className="border-b border-border/50">
                  <td className="py-2 font-sans">{emp.name}</td>
                  <td className="text-muted">{emp.email}</td>
                  <td className="text-muted">{emp.department ?? "—"}</td>
                  <td className={emp.active ? "text-risk-low" : "text-muted"}>{emp.active ? "ACTIVE" : "INACTIVE"}</td>
                  <td className="text-right">
                    {emp.active && (
                      <button onClick={() => deactivate(emp.id)} className="text-xs text-risk-high hover:underline">
                        deactivate
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {employees.length === 0 && (
                <tr><td colSpan={5} className="py-6 text-center text-muted">No employees yet — import a CSV above.</td></tr>
              )}
            </tbody>
          </table>
        </Panel>
      </main>
    </div>
  );
}
```

- [ ] **Step 3: Landing page**

`client/src/pages/Landing.tsx`:
```tsx
import { Link } from "react-router-dom";
import { Stat } from "../components/ui/Stat";

export default function Landing() {
  return (
    <div className="relative min-h-full overflow-hidden">
      <div className="soc-grid pointer-events-none absolute inset-0" />
      <header className="relative flex items-center justify-between px-8 py-5">
        <div className="font-mono text-sm tracking-widest text-accent">SENTRYPHISH</div>
        <nav className="flex items-center gap-5 text-sm">
          <Link to="/login" className="text-muted hover:text-text">Sign in</Link>
          <Link to="/signup" className="rounded-sm border border-accent/40 bg-accent/10 px-4 py-2 text-accent">
            Start free
          </Link>
        </nav>
      </header>

      <main className="relative mx-auto max-w-5xl px-8 pt-20">
        <div className="font-mono text-xs uppercase tracking-[0.3em] text-accent">Phishing simulation · Security awareness</div>
        <h1 className="mt-4 max-w-3xl text-5xl font-semibold leading-tight">
          Find the click before an attacker does.
        </h1>
        <p className="mt-5 max-w-2xl text-lg text-muted">
          SentryPhish runs consented phishing simulations against your own staff, turns every click
          into a teachable moment, and gives leadership one number that matters — your organization's
          human risk score.
        </p>
        <div className="mt-8 flex gap-4">
          <Link to="/signup" className="rounded-sm border border-accent/40 bg-accent/10 px-6 py-3 text-accent">
            Provision your organization
          </Link>
          <Link to="/login" className="rounded-sm border border-border px-6 py-3 text-muted hover:text-text">
            Sign in
          </Link>
        </div>

        <div className="mt-16 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Stat label="Avg. SMB click rate" value="1 in 3" tone="risk-high" />
          <Stat label="Training trigger" value="On click" tone="accent" />
          <Stat label="Setup time" value="< 10 min" />
        </div>

        <p className="mt-16 max-w-2xl text-xs text-muted">
          Built for consented internal testing only. SentryPhish never captures real credentials and
          uses fictional brands in its templates. See our Responsible Use guidance.
        </p>
      </main>
    </div>
  );
}
```

- [ ] **Step 4: Build + manual verification**

```bash
npm run build -w client
```
Expected: type-checks and builds with no errors.

With both services running (`npm run dev`): sign up → `/app` shows the dashboard shell → go to Employees → upload a CSV (`name,email,department`) → see the import summary and the populated table → deactivate one → status flips to INACTIVE. Visit `/` for the landing page.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: client dashboard shell, employees page, landing page"
```

---

## Task 9: README (Responsible Use / GDPR), Railway config, final polish

**Files:**
- Create: `README.md`, `railway.json`
- Modify: none (verification task)

- [ ] **Step 1: README with Responsible Use / GDPR section**

`README.md`:
```markdown
# SentryPhish (TryggNät Säkerhet)

Consented phishing-simulation & security-awareness platform for SMBs.

## Local development

1. `docker compose up -d`            # Postgres 16 (+ a sentryphish_test DB)
2. `cp .env.example .env`
3. `npm install`
4. `npm run db:migrate`              # apply Prisma migrations
5. `npm run dev`                     # API :4000 + client :5173
6. `npm test`                        # server test suite (incl. cross-org isolation)

## Responsible use

SentryPhish is an **authorized internal security-awareness tool**, not a phishing kit.

- **Consent is required.** Creating an organization requires confirming you have legal
  authority to simulate phishing against the employees you upload. This consent (timestamp +
  hashed IP) is stored as an immutable record.
- **No credentials are ever captured.** Simulated landing pages record only the boolean fact
  that a form would have been submitted. There is no field anywhere in the database to store a
  password an employee types.
- **No real-brand impersonation.** Templates use fictional brands (e.g. "Acme IT Portal").
- **GDPR.** Employee names, emails, and engagement events are personal data. Process them
  under a lawful basis (typically legitimate interest for security), minimize retention, and
  give staff prior notice. Raw IPs are never stored — only salted/hashed values.
- **Swedish employment law.** Give employees appropriate advance notice before running
  simulations; coordinate with worker representatives where applicable.

## Architecture

npm-workspaces monorepo: `server` (Express + Prisma + PostgreSQL) and `client` (Vite +
React + Tailwind). JWT auth in an httpOnly cookie. Every tenant-owned query is scoped by
`organizationId`. Deploys to Railway as two services.
```

- [ ] **Step 2: Railway config**

`railway.json`:
```json
{
  "$schema": "https://railway.app/railway.schema.json",
  "build": { "builder": "NIXPACKS" },
  "deploy": {
    "startCommand": "npm run db:migrate:deploy -w server && npm run start -w server",
    "restartPolicyType": "ON_FAILURE"
  }
}
```
> Note: the `client` is deployed as a second Railway service (static site) built with
> `npm run build -w client`, serving `client/dist`. Set `VITE_API_URL` to the API service URL
> and `CLIENT_ORIGIN` (on the API) to the client URL. `COOKIE_SECURE=true` in production.

- [ ] **Step 3: Full verification**

```bash
docker compose up -d
npm install
npm run db:migrate
npm test
npm run build
```
Expected: migrations apply, all server tests pass, both workspaces build.

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "docs: README (responsible use / GDPR) + railway config"
```

---

## Self-review (completed)

- **Spec coverage:** scaffold (T1), full schema (T2), multi-tenant isolation (T4 middleware + T5 isolation test), signup+consent (T4), login/logout (T4), CSV upload (T5), design language (T6), Phase-1 screens incl. landing (T7–T8), README guardrails (T9), Railway (T9). All §1–§12 spec items map to a task.
- **Placeholder scan:** no TODO/TBD; every code step shows complete code.
- **Type consistency:** `AuthTokenPayload` shape is identical in `jwt.ts`, `auth.ts`, and `signAuthToken` call sites; `ImportSummary` shape matches between `employees.service.ts` and the `Employees.tsx` consumer; cookie name `sp_token` is centralized in `cookie.ts` and asserted in tests.
- **Known intentional simplification:** `AdminUser.email` is globally unique (one email ⇒ one org) in Phase 1.
```
