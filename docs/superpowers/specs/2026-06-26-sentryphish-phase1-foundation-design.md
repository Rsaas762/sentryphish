# SentryPhish — Phase 1 (Foundation) Design

**Product:** SentryPhish (brand: TryggNät Säkerhet) — a consented phishing-simulation &
security-awareness platform for Swedish SMBs.
**Date:** 2026-06-26
**Status:** Approved for implementation
**This spec covers:** Phase 1 (Foundation). Phases 2–5 are described only where they
constrain Phase 1 decisions (notably the database schema, which is defined in full now).

---

## 1. Goal & scope

Phase 1 delivers the foundation the rest of the product is built on:

- Monorepo scaffold (`/server`, `/client`) deployable to Railway.
- The **complete** Prisma schema for all five phases, with only the Phase-1 tables wired
  to working endpoints/UI.
- Multi-tenant data isolation enforced from the first query.
- Admin auth: signup (with a legally-required consent record), login, logout.
- Employee management: CSV upload (`name, email, department`), list, manual add, deactivate.
- The dark-first "security operations center" design language, established now so every
  later screen is consistent.
- Ethical/legal guardrails baked in (see §8).

### Out of scope for Phase 1 (schema present, no logic/UI yet)
Email sending, template rendering, tracked links/pixels, fake landing pages, campaign
engine, risk computation, training modules, PDF reports, dashboard charts, billing, logo
upload, email verification, password reset.

---

## 2. Tech & tooling decisions

| Area | Decision |
|------|----------|
| Language | TypeScript (server + client) |
| Backend | Node 20 LTS, Express |
| ORM / DB | Prisma + PostgreSQL 16 |
| Frontend | React + Vite + Tailwind |
| Validation | zod (request bodies, env, CSV rows) |
| Auth | bcrypt password hashing, JWT in an httpOnly + SameSite cookie |
| Monorepo | npm workspaces (`server`, `client`); two Railway services |
| Local DB | Docker Compose Postgres 16 (zero manual setup) |
| Tests | vitest + supertest |
| Type pairing | IBM Plex Mono (numerics/data) + IBM Plex Sans (body) |

Defaults chosen deliberately: TypeScript keeps the multi-tenant scoping type-safe and reads
as a credible security/portfolio codebase; the IBM Plex pairing gives a technical/telemetry
feel while staying free and explicitly avoiding the default Inter/Geist look.

---

## 3. Folder structure

```
sentryphish/
  package.json            # workspaces: ["server","client"], root scripts (dev, test, db:*)
  docker-compose.yml      # postgres:16 service
  railway.json            # Railway service config
  .env.example
  README.md               # incl. Responsible Use / GDPR section
  docs/superpowers/specs/
  server/
    package.json
    tsconfig.json
    prisma/
      schema.prisma
      migrations/
      seed.ts             # seed system phishing templates + training modules (later phases)
    src/
      index.ts            # express bootstrap
      env.ts              # zod-validated environment
      prisma.ts           # PrismaClient singleton
      middleware/
        auth.ts           # verify JWT cookie -> req.auth { adminUserId, organizationId, role }
        tenant.ts         # centralizes where:{ organizationId } scoping helper
        errorHandler.ts
        rateLimit.ts      # per-org send rate limit (scaffold; enforced Phase 2)
      modules/
        auth/             # routes + service + zod schema + consent handling
        organizations/
        employees/        # CSV upload + parsing + list/add/deactivate
      lib/
        password.ts       # bcrypt wrappers
        jwt.ts            # sign/verify
        csv.ts            # parse + validate
    test/                 # API tests incl. cross-org isolation
  client/
    package.json
    index.html
    vite.config.ts
    tailwind.config.ts
    postcss.config.js
    src/
      main.tsx  App.tsx  router.tsx
      styles/{tokens.css, globals.css}
      lib/{api.ts (fetch, credentials:'include'), auth.tsx (context)}
      components/ui/{Button, Field, Panel, Stat}
      pages/{Landing, Signup, Login, Dashboard(shell), Employees}
```

---

## 4. Database schema (full, all phases)

Design principles:

- Every tenant-owned row carries `organizationId`.
- `CampaignRecipient` holds the **unique per-recipient tracking token** (Phase 2).
- An `EmailEvent` of type `SUBMITTED` records only the *fact* of a simulated submission —
  **there is deliberately no column anywhere in the schema to hold a submitted password or
  any captured credential.**
- `RiskScore` is a time-series snapshot; `employeeId = null` means an org-level aggregate,
  so trend-over-time falls out of querying ordered snapshots.

```prisma
enum AdminRole        { OWNER ADMIN }
enum TemplateCategory { INVOICE IT_PASSWORD_RESET HR_POLICY DELIVERY_NOTIFICATION CEO_BEC }
enum Language         { SV EN }
enum CampaignStatus   { DRAFT SCHEDULED SENDING COMPLETED CANCELLED }
enum RecipientStatus  { PENDING SENT OPENED CLICKED SUBMITTED REPORTED }
enum EmailEventType   { SENT OPENED CLICKED SUBMITTED REPORTED }   // SUBMITTED = boolean fact only
enum TrainingStatus   { ASSIGNED IN_PROGRESS COMPLETED }
enum RiskBand         { LOW ELEVATED HIGH CRITICAL }

model Organization {
  id                      String   @id @default(cuid())
  name                    String
  slug                    String   @unique
  // consent record (guardrail, immutable once set)
  legalAuthorityConfirmed Boolean  @default(false)
  consentAt               DateTime?
  consentByAdminUserId    String?
  consentIpHash           String?
  // sending safety (guardrail)
  sendingDomain           String?
  domainVerified          Boolean  @default(false)
  domainVerifyToken       String?
  // branding (Phase 5)
  logoUrl                 String?
  primaryColor            String?
  createdAt               DateTime @default(now())
  updatedAt               DateTime @updatedAt
  adminUsers   AdminUser[]
  employees    Employee[]
  campaigns    Campaign[]
  templates    PhishingTemplate[]
  trainings    TrainingModule[]
  riskScores   RiskScore[]
  smtpConfig   SmtpConfig?
}

model AdminUser {
  id             String   @id @default(cuid())
  organizationId String
  organization   Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  email          String   @unique
  passwordHash   String
  name           String
  role           AdminRole @default(OWNER)
  createdAt      DateTime @default(now())
  @@index([organizationId])
}

model Employee {
  id             String   @id @default(cuid())
  organizationId String
  organization   Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  name           String
  email          String
  department     String?
  active         Boolean  @default(true)
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt
  recipients     CampaignRecipient[]
  trainings      TrainingCompletion[]
  @@unique([organizationId, email])     // dedup within org
  @@index([organizationId])
}

model PhishingTemplate {
  id             String   @id @default(cuid())
  organizationId String?                 // null = system/global template
  organization   Organization? @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  name           String
  category       TemplateCategory
  language       Language
  subject        String
  senderName     String                  // fictional only (e.g. "Acme IT Portal")
  senderEmail    String
  bodyHtml       String
  landingConfig  Json?                    // fake form layout descriptor (never stores inputs)
  redFlags       Json                     // [{type, explanation}] feeds training
  isSystem       Boolean  @default(false)
  createdAt      DateTime @default(now())
  recipients     CampaignRecipient[]
  @@index([organizationId])
}

model Campaign {
  id                   String   @id @default(cuid())
  organizationId       String
  organization         Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  name                 String
  status               CampaignStatus @default(DRAFT)
  scheduledAt          DateTime?
  sentAt               DateTime?
  createdByAdminUserId String?
  createdAt            DateTime @default(now())
  recipients           CampaignRecipient[]
  riskScores           RiskScore[]
  @@index([organizationId])
}

model CampaignRecipient {
  id             String   @id @default(cuid())
  organizationId String                   // denormalized for scoping
  campaignId     String
  campaign       Campaign @relation(fields: [campaignId], references: [id], onDelete: Cascade)
  employeeId     String
  employee       Employee @relation(fields: [employeeId], references: [id], onDelete: Cascade)
  templateId     String
  template       PhishingTemplate @relation(fields: [templateId], references: [id])
  trackingToken  String   @unique          // unique per recipient (Phase 2)
  status         RecipientStatus @default(PENDING)
  sentAt         DateTime?
  events         EmailEvent[]
  trainings      TrainingCompletion[]
  @@index([organizationId])
  @@index([campaignId])
}

model EmailEvent {
  id                  String   @id @default(cuid())
  organizationId      String
  campaignRecipientId String
  recipient           CampaignRecipient @relation(fields: [campaignRecipientId], references: [id], onDelete: Cascade)
  type                EmailEventType         // SUBMITTED carries NO credential data
  occurredAt          DateTime @default(now())
  ipHash              String?
  userAgent           String?
  @@index([organizationId])
  @@index([campaignRecipientId])
}

model TrainingModule {
  id              String   @id @default(cuid())
  organizationId  String?                  // null = system module
  organization    Organization? @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  category        TemplateCategory
  language        Language
  title           String
  contentJson     Json
  quizJson        Json
  isSystem        Boolean  @default(false)
  completions     TrainingCompletion[]
  @@index([organizationId])
}

model TrainingCompletion {
  id                  String   @id @default(cuid())
  organizationId      String
  employeeId          String
  employee            Employee @relation(fields: [employeeId], references: [id], onDelete: Cascade)
  trainingModuleId    String
  trainingModule      TrainingModule @relation(fields: [trainingModuleId], references: [id])
  campaignRecipientId String?
  recipient           CampaignRecipient? @relation(fields: [campaignRecipientId], references: [id])
  status              TrainingStatus @default(ASSIGNED)
  quizScore           Int?
  startedAt           DateTime?
  completedAt         DateTime?
  @@index([organizationId])
  @@index([employeeId])
}

model RiskScore {
  id             String   @id @default(cuid())
  organizationId String
  organization   Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  employeeId     String?                   // null = org-level aggregate snapshot
  campaignId     String?
  campaign       Campaign? @relation(fields: [campaignId], references: [id])
  score          Int
  band           RiskBand
  computedAt     DateTime @default(now())
  @@index([organizationId])
  @@index([employeeId])
}

model SmtpConfig {
  id             String   @id @default(cuid())
  organizationId String   @unique
  organization   Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  host           String
  port           Int
  secure         Boolean  @default(true)
  username       String
  passwordEnc    String                    // encrypted at rest, not plaintext
  fromName       String
  fromEmail      String
  verified       Boolean  @default(false)
}
```

---

## 5. Multi-tenant isolation

- `auth` middleware verifies the JWT cookie and attaches
  `req.auth = { adminUserId, organizationId, role }`.
- Every service function takes `organizationId` as its first argument; every Prisma query
  filters on it. A `tenant` helper centralizes the `where: { organizationId }` clause so it
  cannot be silently omitted.
- **Isolation is proven by test first (TDD):** a test asserts that org A's authenticated
  requests cannot read or mutate org B's employees (404/forbidden, never leakage).
- Postgres row-level security is noted as future hardening, not part of Phase 1.

---

## 6. Auth flow + consent

**Signup** — body: `{ name, orgName, email, password, legalAuthorityConfirmed }`.
- Server **rejects** if `legalAuthorityConfirmed` is not `true` (enforced server-side, not
  just a client checkbox).
- In one transaction: create `Organization` + `OWNER` `AdminUser`; stamp `consentAt`,
  `consentByAdminUserId`, and `consentIpHash` (the IP is **hashed**, never stored raw — GDPR
  data-minimization).
- Issue JWT in an httpOnly, SameSite cookie.

**Login** — bcrypt verify → set cookie. **Logout** — clear cookie.
**Deferred:** email verification, password reset (later phase; no guaranteed SMTP yet).

---

## 7. Employee CSV upload

- Endpoint accepts a `name,email,department` CSV, parsed server-side (`csv-parse`).
- Each row zod-validated; invalid rows collected and returned, not fatal.
- Deduped by email within the org (`@@unique([organizationId, email])`), upserted.
- Response: `{ created, updated, skipped, errors: [{ row, reason }] }`.
- Also: list employees, manual single add, deactivate (soft — `active=false`).
- A soft nudge toward the 50-user plan in the UI; not hard-enforced in Phase 1.

---

## 8. Ethical & legal guardrails in Phase 1

- **Consent gate** enforced server-side; consent record is immutable once set.
- **IP hashed**, never stored raw.
- **No credential storage** is structurally guaranteed: the schema has no field anywhere to
  hold a submitted password; `SUBMITTED` is only an event type.
- **README** ships a Responsible Use + GDPR section recommending prior staff notice per
  Swedish employment law.
- `domainVerified` flag and per-org rate-limit middleware are scaffolded now and will gate
  the first real send in Phase 2.

---

## 9. Design language (established now)

Dark-first SOC / threat-intel aesthetic — not a light theme with a dark toggle.

- **Base** `#0A0C10`, **panels** `#12161F`, **hairline borders** `#1E2530`.
- **Text** `#E6EAF0`, **muted** `#8A94A6`.
- **Color carries risk meaning** (the risk scale, reused everywhere): LOW `#34D399`
  (teal-green / secure) · ELEVATED `#F5A623` (amber) · HIGH `#FB7185` (orange-red) ·
  CRITICAL `#EF4444` (red). Brand accent = cyan/teal.
- Sharp 2–4px radii, no bubbly cards, no emoji icons, no stock gradient blobs.
- Mono (IBM Plex Mono) for all numerics/metrics; IBM Plex Sans for body.
- Phase 1 ships Login, Signup, Employees, a Dashboard shell, and a basic Landing page in
  this language. The full dashboard with the hero risk-score centerpiece and live-feeling
  micro-interactions lands in Phase 5. The `frontend-design` skill is applied during
  implementation of these screens.

---

## 10. Local development & testing

```
docker compose up -d                 # Postgres 16
npm install                          # root, installs both workspaces
npm run db:migrate && npm run db:seed
npm run dev                          # server + client concurrently
npm test                             # incl. cross-org isolation test
```

Manual walkthrough: sign up (with consent checkbox) → cookie set → upload a sample CSV →
see the employee list → log out / log back in.

---

## 11. Deployment (Railway)

Two services from the one repo: `server` (Express API + Prisma migrate on deploy) and
`client` (static Vite build). `railway.json` declares build/start commands; a managed
Railway Postgres provides `DATABASE_URL`. Secrets (`JWT_SECRET`, DB URL, SMTP) come from
Railway env vars, never committed.

---

## 12. Definition of done for Phase 1

- `docker compose up` + `npm run dev` yields a working signup → login → CSV upload flow.
- Consent is server-enforced; the consent record (incl. hashed IP) is persisted.
- Cross-org isolation test passes.
- All screens render in the dark SOC design language.
- README includes the Responsible Use / GDPR section.
- A short "what's built + how to test" summary is delivered before Phase 2 begins.
