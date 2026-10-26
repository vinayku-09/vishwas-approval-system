# Vishwas Approval System

Vishwas is the AICTE approval-workflow and compliance-monitoring platform for Smart India Hackathon 2026 problem statement **SH26262**. It combines role-scoped workflow handling, document intake with hashes, configurable alerts and escalation, Postgres persistence, and an append-only SHA-256 audit ledger. Every automated action is assistive: rejections, overrides and returns remain decisions of the competent authority and require recorded sign-off or remarks.

> **Demo notice:** All seeded institutions, applications, documents, inspections and alerts are simulated demo data. They are not real AICTE records. Timelines, stage durations, reminder tiers and escalation delays are **placeholders pending the Approval Process Handbook (APH)** and are not official AICTE rules.

## Current Status

Last verified locally on **2026-10-26**. No deployment has been performed.

| Check | Result |
| :--- | :--- |
| Backend typecheck | Passed (`npm run build`) |
| Backend tests | **129 passed / 129** in 10 test files |
| Frontend production build | Passed (`next build`, 9/9 pages generated) |
| Neon migration | Applied; 12 public tables plus `drizzle.__drizzle_migrations` |
| Active backend store | Postgres / Neon |
| Seeded login and `/auth/me` | Passed |
| Alert cron, email preview and ledger | Passed with `MAIL_MODE=ethereal` |
| Cron idempotency | Second run created 0 alerts and skipped 37 duplicates |

### Built and tested

- JWT login, bcrypt password verification, 8-hour signed sessions and role-aware claims.
- Legacy demo-header fallback is disabled by default with `ALLOW_DEMO_HEADER_ROLE=false`.
- Role/region scoping for applications, documents, inspections, ledger views, notifications and escalations, with authenticated boundary tests.
- Four configurable PS approval routes (`ONLY_SCRUTINY`, `SCRUTINY_EVC`, `EVC_SAC_SHC`, `ONLY_EVC`) with canonical stage order, automatic progression, guarded return/revert targets and categories.
- Standard return and decision notices issued to institutions with in-app notifications and `NOTICE_ISSUED` ledger entries.
- Read-only electronic case summary at `/case/[id]` with route, timeline, returns, sign-off, documents, inspections, notices and ledger verification.
- Universal human-decision safeguard notice on officer advance/review, committee EVC report and case-summary screens.
- Strict workflow state machine, human sign-off gate for rejection, and cryptographic ledger writes.
- Neon Postgres persistence with Drizzle migrations and a deterministic demo seed.
- Multipart PDF/PNG/JPG document upload with SHA-256 hashing and local or Vercel Blob storage.
- Daily document-expiry monitor with warning tiers and application locking.
- Config-driven reminder and escalation engine, in-app notifications, email adapter and ledger entries.
- TypeScript vehicle-routing fallback for EVC inspection scheduling with conflict-of-interest exclusion.
- Next.js portal pages for login, institution, officer, committee, alerts and public ledger verification.
- Ethereal alert email delivery verified with preview URLs; live SMTP credentials are not verified.

### Built with mock or placeholder data

- AI document extraction is a deterministic mock unless `AI_GATEWAY_API_KEY` is configured. No live model extraction was run in Step 0.
- The Python OR-Tools optimizer exists in `optimizer/api/optimize.py` but was not run or deployed; the tested path is the TypeScript fallback.
- The 21-day SLA windows, 80% warning threshold, 90/60/30-day expiry tiers, 30/15/7/1 reminder offsets and escalation delays are placeholders pending the APH.
- Approval routes, stage order, automatic-next-stage rules, return targets and return categories are placeholders pending the APH. There are no official AICTE route mappings in this prototype.
- The demo dataset is simulated and intentionally contains no real personal data.
- Email delivery was verified with Ethereal; Gmail/live SMTP was rejected as configured and remains unverified.
- EVC inspection durations, working hours, travel speed and distance factors are prototype assumptions.

### Not built yet / roadmap

- **Part 3:** stage SLA config, pendency dashboards, ageing buckets, workload and bottleneck views, EVC status board.
- **Part 4:** undertakings, evidence verification, renewals and unlock-after-renewal.
- **Part 6:** six reports with CSV export, searchable audit view and expanded demo seed.
- Authenticity checks, RAG, fraud map and QR certificates remain out of scope until Parts 2, 3, 4 and 6 are complete.
- Part 2a closes the application, document, inspection and ledger read-scoping gaps. Re-review all new read endpoints before deployment.
- The new route metadata is derived at response time; only returns are stored in the application JSONB payload. Policy approval of the route map is still required.

## Step 0 Verification

### Database and seed

- `npm run db:migrate` applied successfully against Neon.
- Public tables: `applications`, `users`, `documents`, `compliance_documents`, `inspections`, `inspectors`, `affiliations`, `ledger`, `signoffs`, `notifications`, `alert_logs`, `escalations`.
- `db:seed` is sequentially idempotent: it deletes all rows from the 12 application tables, then reloads deterministic demo IDs. It is destructive to manual changes and new records, so it must be run only when resetting demo data.
- Seed result: 15 applications, 7 users, 2 documents, 3 inspections, 30 ledger entries and 2 notifications.

### Persistence and authentication

- Backend startup log confirms `Store: POSTGRES (DATABASE_URL configured)`, so the running process used Neon rather than the in-memory store.
- Seeded login succeeded for `officer.west@aicte.gov.in` with role `OFFICER` and region `WEST`; `/auth/me` returned the same claims.
- A request with only `x-role: CHIEF` and no JWT returned HTTP 401 while `ALLOW_DEMO_HEADER_ROLE=false`.

### Alert run and idempotency

- First `/cron/alerts` run: 21 reminders, 16 escalations, 37 in-app notifications, 37 emails queued, 0 failed.
- One Ethereal preview verified with HTTP 200:
  [open preview](https://ethereal.email/message/at8FGkOFvInRgwovat8FHXOU4XPkrBCbAAAAAQSfZahBqL5GePoY-ZusV0g)
- The same alert produced `EVC_SCHEDULING:APP-2024-005:ESCALATION:1` in `alert_logs`, notification `NOTIF-EVC_SCHEDULING:APP-2024-005:ESCALATION:1`, and ledger entry `LEDGER-APP-2024-005-4` (`ALERT_ESCALATION`, actor `system:alert-engine`).
- Ledger verification for `APP-2024-005` returned `valid: true` with the hash chain intact.
- Second cron run: 0 reminders, 0 escalations, 0 notifications, 0 emails, **37 duplicates skipped**. Counts stayed at 37 alert logs, 39 notifications, 67 ledger entries and 16 escalations.

## Part 2: Routes, Returns and Case Summary

Approval routes are resolved from application type at response time using `backend/src/config/routes.ts`; `EVC_SAC_SHC` is a first-class `APPEAL` application route and is also selected for rejected/appeal statuses through a configured status override. Route metadata is not persisted, so no migration is required; return records are appended to the application JSONB payload.

| Route | Selected for | Stages | EVC required | Return categories |
| :--- | :--- | :--- | :--- | :--- |
| `ONLY_SCRUTINY` | `EXTENSION_OF_APPROVAL` | SUBMITTED -> SCRUTINY -> DECISION | No | Deficiency, document missing, clarification, compliance, other |
| `SCRUTINY_EVC` | `NEW` | SUBMITTED -> SCRUTINY -> EVC_REQUIRED -> EVC_DONE -> DECISION | Yes | Same |
| `EVC_SAC_SHC` | `APPEAL`; also `REJECTED`, `APPEAL_SHC`, `APPEAL_SAC` | SUBMITTED -> SCRUTINY -> EVC_REQUIRED -> EVC_DONE -> DECISION -> APPEAL_SHC -> APPEAL_SAC | Yes | Same |
| `ONLY_EVC` | `INTAKE_CHANGE` | SUBMITTED -> EVC_REQUIRED -> EVC_DONE -> DECISION | Yes | Same |

- The four route ids and stage lists are the canonical PS route configuration. Future stage-SLA configuration must import those stage lists instead of repeating stage names.
- `EVC_SAC_SHC` uses the existing state-machine order SHC then SAC, even though the PS short name lists SAC/SHC.
- `POST /applications/:id/advance` can omit `to`; the configured automatic next stage is used only for `SUBMITTED`, `DEFICIENT`, `SCRUTINY` and `EVC_DONE`. `EVC_REQUIRED`, `DECISION` and appeal stages always need a human-selected target.
- A globally valid transition is rejected if it is not part of the selected route (for example `ONLY_SCRUTINY` cannot jump to `EVC_REQUIRED`).
- `POST /applications/:id/return` requires `OFFICER` or `CHIEF`, an in-scope application, a configured return target, a category and a reason of at least 10 characters. It writes `APPLICATION_RETURNED` and `NOTICE_ISSUED` ledger entries and notifies the institution.
- Terminal decisions issue a standard decision notice. All decision screens show a human-decision safeguard notice.
- `GET /applications/:id/case-summary` returns a scoped, read-only electronic case summary. It does not mutate state.
- All routes, stage rules, return targets and notice text are placeholders pending the APH.

## Demo Users

All demo records are simulated. Use the one-click seeded demo buttons on `/login`; the non-production demo password is shown on the login screen.

| Email | Role | Region |
| :--- | :--- | :--- |
| `chief@aicte.gov.in` | `CHIEF` | ALL |
| `committee@aicte.gov.in` | `COMMITTEE` | WEST |
| `delhi.tech@aicte.gov.in` | `INSTITUTION` | - |
| `kaveri.poly@aicte.gov.in` | `INSTITUTION` | - |
| `vjti@mumbai.edu` | `INSTITUTION` | - |
| `officer@aicte.gov.in` | `OFFICER` | ALL |
| `officer.west@aicte.gov.in` | `OFFICER` | WEST |

## Local Setup

Requires Node.js 18 or newer. Postgres/Neon is optional for local exploration but required for the verified persistence path.

```bash
# Backend
cd backend
npm install
npm run dev

# Frontend, in a second terminal
cd frontend
npm install
npm run dev
```

Local URLs:

- Frontend: `http://localhost:3000`
- Backend health: `http://localhost:4000/health`
- Alerts cron: `POST http://localhost:4000/cron/alerts`
- Ledger verification: `GET http://localhost:4000/ledger/APP-2024-001/verify`
- Case summary: `GET http://localhost:4000/applications/APP-2024-001/case-summary` (bearer token)
- Return/revert: `POST http://localhost:4000/applications/APP-2024-005/return` (officer/CHIEF bearer token)

### Postgres / Neon

Set the environment variable names below in `backend/.env`, then run:

```bash
cd backend
npm run db:migrate
npm run db:seed
npm run dev
```

Without `DATABASE_URL`, the backend uses the in-memory demo store and startup logs `Store: IN-MEMORY`.

### Tests and build

```bash
cd backend
npx tsc --noEmit
npm test

cd ../frontend
npm run build
```

Postgres-specific tests use `TEST_DATABASE_URL` when provided; otherwise they run against `pg-mem`.

## Environment Variables

Values are intentionally omitted. Use `backend/.env.example`, `frontend/.env.example`, and your deployment provider. Never commit `.env`.

| Project | Variable names |
| :--- | :--- |
| Backend | `PORT`, `NODE_ENV`, `DATABASE_URL`, `JWT_SECRET`, `CRON_SECRET`, `BLOB_READ_WRITE_TOKEN`, `AI_GATEWAY_API_KEY`, `AI_GATEWAY_BASE_URL`, `EXTRACTION_MODEL`, `MAIL_MODE`, `MAIL_FROM`, `ALERT_EMAIL_OVERRIDE`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `PORTAL_URL`, `ALLOW_DEMO_HEADER_ROLE`, `OPTIMIZER_URL` |
| Frontend | `NEXT_PUBLIC_API_URL` |
| Optimizer | No runtime environment variables are read by the current Vercel Python function. The backend reaches it through `OPTIMIZER_URL`. |
| Tests only | `TEST_DATABASE_URL` |

Notes:

- `ALERT_EMAIL_OVERRIDE` routes all alert emails to one inbox for demo/testing. The original role recipient remains recorded in the alert log.
- `MAIL_MODE=ethereal` creates a test inbox and logs a preview URL. It never sends production mail.
- `MAIL_MODE=live` requires valid SMTP credentials. Do not commit them.
- `ALLOW_DEMO_HEADER_ROLE` must remain `false` outside a controlled demo.

## Safeguard

Automated actions support the approval process and do not replace decisions of the competent authority. The current build enforces a human sign-off gate before rejection, requires a recorded reason and category for every return, records overrides with remarks in the ledger, and shows a human-decision safeguard notice on officer advance/review, committee EVC report and case-summary screens. Route and stage settings remain placeholders pending the APH.

## PS Compliance

| Area | Key requirement | Status | Notes |
| :--- | :--- | :--- | :--- |
| A | Routing and return/revert | Built with placeholders | The four PS routes, canonical stage sequences, route-aware progression, guarded return targets/categories, standard notices and read-only case summary exist. Route policy approval is pending the APH. |
| B | Pendency dashboards | Partial foundation | SLA fields, expiry alerts and escalation engine exist; stage SLA config, dashboards, ageing buckets and bottleneck views are Part 3. |
| C | Visibility and EVC status | Partial | EVC scheduling, scoped notifications and case summary exist; EVC status board and delayed-case visibility are Part 3. |
| D | Undertakings | Not built | Part 4 will add conditions, evidence, verification and overdue escalation. |
| E | Renewals | Not built | Part 4 will add renewal submission, verification, validity update and application unlock. |
| F | Reports and demo data | Not built | Part 6 will add six filtered reports, CSV export, searchable audit view and a larger demo seed. |
| Safeguard | Human authority and recorded reasons | Built for current decision screens | Rejection sign-off, return reasons/categories, override remarks and decision notices exist. New decision screens must reuse `SafeguardNotice`. |
| Audit | Every state change and alert in ledger | Partial | State changes, returns, notices and alerts write ledger entries; full reads are auth and role/region scoped, and public verification returns validity metadata only. |

## Documentation

- [Architecture](docs/ARCHITECTURE.md)
- [Assumptions and placeholders](docs/assumptions.md)
- [Changelog](CHANGELOG.md)

## Deployment Checklist

No live links exist yet. When deploying:

- Backend on Vercel: root directory `backend`, build `npm run build`, add the backend variable names above, run migrations and seed against the intended database.
- Frontend on Vercel: root directory `frontend`, framework Next.js, set `NEXT_PUBLIC_API_URL` to the deployed backend origin.
- Optimizer: deploy the Python function only if the OR-Tools path is needed, then point backend `OPTIMIZER_URL` at it.
- Scheduler: `backend/vercel.json` defines daily `/cron/expiry-check` and `/cron/alerts` cron jobs. Verify the deployment plan supports them.
- Post-deploy: confirm `/health`, seeded login, alert cron, email mode, ledger verification and role boundaries.
- Never expose `.env`; confirm no secret values appear in logs, build output or the repository.
