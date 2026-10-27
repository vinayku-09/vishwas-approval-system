# Vishwas Approval System

Vishwas is the AICTE approval-workflow and compliance-monitoring platform for Smart India Hackathon 2026 problem statement **SH26262**. It combines role-scoped workflow handling, document intake with hashes, configurable alerts and escalation, Postgres persistence, and an append-only SHA-256 audit ledger. Every automated action is assistive: rejections, overrides and returns remain decisions of the competent authority and require recorded sign-off or remarks.

> **Demo notice:** All seeded institutions, applications, documents, inspections and alerts are simulated demo data. They are not real AICTE records. Timelines, stage durations, reminder tiers and escalation delays are **placeholders pending the Approval Process Handbook (APH)** and are not official AICTE rules.

## Current Status

Last verified locally on **2026-10-26**. No deployment has been performed.

| Check | Result |
| :--- | :--- |
| Backend typecheck | Passed (`npm run build`) |
| Backend tests | **253 passed / 253** in 17 test files |
| Frontend production build | Passed (`next build`, 11/11 pages generated) |
| Neon migration | Applied; 16 public tables plus `drizzle.__drizzle_migrations` |
| Active backend store | Postgres / Neon |
| Seeded login and `/auth/me` | Passed |
| Alert cron, email preview and ledger | Passed with `MAIL_MODE=ethereal` |
| Cron idempotency | Second run created 0 alerts and skipped 37 duplicates |

### Built and tested

- JWT login, bcrypt password verification, 8-hour signed sessions and role-aware claims.
- Legacy demo-header fallback is disabled by default with `ALLOW_DEMO_HEADER_ROLE=false`.
- Role/region scoping for applications, documents, inspections, ledger views, notifications, escalations, undertakings and renewals.
- Four configurable PS approval routes (`ONLY_SCRUTINY`, `SCRUTINY_EVC`, `EVC_SAC_SHC`, `ONLY_EVC`) with canonical stage order, automatic progression, guarded return/revert targets and categories.
- Standard return and decision notices issued to institutions with in-app notifications and `NOTICE_ISSUED` ledger entries.
- Read-only electronic case summary at `/case/[id]` with route, timeline, returns, sign-off, documents, inspections, notices and ledger verification.
- Universal human-decision safeguard notice on officer advance/review, committee EVC report, case-summary and verification queue screens.
- Strict workflow state machine, human sign-off gate for rejection, and cryptographic ledger writes.
- Neon Postgres persistence with Drizzle migrations (`0000_initial`, `0001_undertakings_renewals`) and deterministic demo seed.
- Multipart PDF upload with PDF magic-byte (`%PDF-`) verification, 10 MB size limit, SHA-256 hashing.
- **Vercel Blob Storage Mode** (`STORAGE_MODE=local|postgres|blob`): private-access Blob uploads with `addRandomSuffix:true`, SHA-256 re-verification on serve, `Cache-Control: private, no-store`, 409 on hash mismatch, DRAFT-only deletion, no public URLs.
- Daily document-expiry monitor with warning tiers, overdue marking, and application locking.
- Config-driven reminder and escalation engine, in-app notifications, email adapter and ledger entries.
- Statutory undertakings lifecycle: condition text, due date, evidence upload with SHA-256 hashing, officer verification queue, rejection safeguards (remarks + sign-off required), and automated overdue marking.
- Compliance document renewals: submission of renewed documents, regional officer verification queue, validity date extension, and automatic application unlocking once all overdue documents are cleared.
- TypeScript vehicle-routing fallback for EVC inspection scheduling with conflict-of-interest exclusion.
- Next.js portal pages for login, institution, officer, committee, alerts, pendency dashboards, EVC board and public ledger verification.
- Ethereal alert email delivery verified with preview URLs; live SMTP credentials are not verified.

### Built with mock or placeholder data

- AI document extraction is a deterministic mock unless `AI_GATEWAY_API_KEY` is configured. No live model extraction was run in Step 0.
- The Python OR-Tools optimizer exists in `optimizer/api/optimize.py` but was not run or deployed; the tested path is the TypeScript fallback.
- Default undertaking duration (30 days) and renewal validity periods (FIRE_NOC 365, LEASE_DEED 1095, LAND_RECORD 1825 days) are placeholders pending the APH in `backend/src/config/undertakings.ts`.
- The 21-day SLA windows, 80% warning threshold, stage SLA days, approaching threshold, ageing bucket edges, 90/60/30-day expiry tiers, 30/15/7/1 reminder offsets and escalation delays are placeholders pending the APH.
- Approval routes, stage order, automatic-next-stage rules, return targets and return categories are placeholders pending the APH. There are no official AICTE route mappings in this prototype.
- The demo dataset is simulated and intentionally contains no real personal data.
- Email delivery was verified with Ethereal; Gmail/live SMTP was rejected as configured and remains unverified.
- EVC inspection durations, working hours, travel speed and distance factors are prototype assumptions.

### Not built yet / roadmap

- **Part 6:** six reports with CSV export, searchable audit view and expanded demo seed.
- Authenticity checks, RAG, fraud map and QR certificates remain out of scope until Parts 2, 3, 4 and 6 are complete.

## Step 0 Verification

### Database and seed

- `npm run db:migrate` applied successfully against Neon.
- Public tables: `applications`, `users`, `documents`, `compliance_documents`, `undertakings`, `evidence`, `verifications`, `inspections`, `inspectors`, `affiliations`, `ledger`, `signoffs`, `notifications`, `alert_logs`, `escalations`.
- `db:seed` is sequentially idempotent: it reloads deterministic demo IDs.
- Seed result includes demo applications, compliance documents, and demo undertakings in each status (`PENDING`, `SUBMITTED`, `VERIFIED`, `REJECTED`, `OVERDUE`).

### Persistence and authentication

- Backend startup log confirms `Store: POSTGRES (DATABASE_URL configured)`, so the running process used Neon rather than the in-memory store.
- Seeded login succeeded for `officer.west@aicte.gov.in` with role `OFFICER` and region `WEST`; `/auth/me` returned the same claims.
- A request with only `x-role: CHIEF` and no JWT returned HTTP 401 while `ALLOW_DEMO_HEADER_ROLE=false`.

### Alert run and idempotency

- First `/cron/alerts` run: reminders and escalations dispatched to in-app notifications and email.
- The same alert produced records in `alert_logs`, notifications, and immutable ledger entries.
- Ledger verification for applications returned `valid: true` with the hash chain intact.
- Second cron run: 0 reminders, 0 escalations, 0 notifications, 0 emails, duplicates skipped.

## Part 2: Routes, Returns and Case Summary

Approval routes are resolved from application type at response time using `backend/src/config/routes.ts`; `EVC_SAC_SHC` is a first-class `APPEAL` application route and is also selected for rejected/appeal statuses through a configured status override. Route metadata is not persisted, so no migration is required; return records are appended to the application JSONB payload.

| Route | Selected for | Stages | EVC required | Return categories |
| :--- | :--- | :--- | :--- | :--- |
| `ONLY_SCRUTINY` | `EXTENSION_OF_APPROVAL` | SUBMITTED -> SCRUTINY -> DECISION | No | Deficiency, document missing, clarification, compliance, other |
| `SCRUTINY_EVC` | `NEW` | SUBMITTED -> SCRUTINY -> EVC_REQUIRED -> EVC_DONE -> DECISION | Yes | Same |
| `EVC_SAC_SHC` | `APPEAL`; also `REJECTED`, `APPEAL_SHC`, `APPEAL_SAC` | SUBMITTED -> SCRUTINY -> EVC_REQUIRED -> EVC_DONE -> DECISION -> APPEAL_SHC -> APPEAL_SAC | Yes | Same |
| `ONLY_EVC` | `INTAKE_CHANGE` | SUBMITTED -> EVC_REQUIRED -> EVC_DONE -> DECISION | Yes | Same |

## Part 3: Pendency dashboards and EVC board

Stage SLA days are derived from the four PS route stage lists in `backend/src/config/routes.ts`. Dashboards compute age in days, days left and On time / Approaching / Overdue using placeholder values pending the APH. `/dashboards/pendency` and `/dashboards/evc-board` are authenticated and scoped.

## Part 4: Undertakings and Renewals

- **Data Model:** `undertakings` (applicationId, conditionText, dueDate, status, createdBy), `evidence` (undertakingId, fileName, fileHash, storageRef, submittedBy, submittedAt), and `verifications` (undertakingId, officer, decision, remarks, timestamp).
- **Store Equivalents:** Both Neon Postgres and in-memory store implement identical semantics and pass all tests.
- **Institution Portal:** Institutions view their own undertakings with due dates, upload signed evidence (PDF/PNG/JPG ≤ 10MB) with SHA-256 calculation, and submit renewed documents for expiring/expired compliance items.
- **Officer Verification Queue:** Regional queue scoped by officer role and regional jurisdiction. Officers verify or reject evidence. Rejection requires written remarks and an existing confirmed sign-off on the application. Verified renewals extend regulatory validity dates and unlock compliance-locked applications.
- **Automation & Ledger:** The daily cron job marks expired undertakings `OVERDUE`. Reminders and escalations dispatch through the alert engine using real due dates. Every submission, verification, rejection, escalation, closure, and unlock writes an immutable ledger entry.

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
- Expiry cron: `POST http://localhost:4000/cron/expiry-check`
- Verification queue: `GET http://localhost:4000/officer/verification-queue` (officer bearer token)
- Ledger verification: `GET http://localhost:4000/ledger/APP-2024-001/verify`
- Case summary: `GET http://localhost:4000/applications/APP-2024-001/case-summary` (bearer token)
- Return/revert: `POST http://localhost:4000/applications/APP-2024-005/return` (officer/CHIEF bearer token)
- Pendency dashboard: `GET http://localhost:4000/dashboards/pendency` (bearer token)
- EVC board: `GET http://localhost:4000/dashboards/evc-board` (bearer token)

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
| Backend | `PORT`, `NODE_ENV`, `DATABASE_URL`, `JWT_SECRET`, `CRON_SECRET`, `BANK_ENCRYPTION_KEY`, `BLOB_READ_WRITE_TOKEN` (server-only, never client), `STORAGE_MODE`, `UPLOAD_DIR`, `AI_GATEWAY_API_KEY`, `AI_GATEWAY_BASE_URL`, `EXTRACTION_MODEL`, `MAIL_MODE`, `MAIL_FROM`, `ALERT_EMAIL_OVERRIDE`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `PORTAL_URL`, `ALLOW_DEMO_HEADER_ROLE`, `OPTIMIZER_URL` |
| Frontend | `NEXT_PUBLIC_API_URL` |
| Optimizer | No runtime environment variables are read by the current Vercel Python function. The backend reaches it through `OPTIMIZER_URL`. |
| Tests only | `TEST_DATABASE_URL` |

## R1: Registration, OTP, Institution Profile & Document Risk

- **Landing Page (`/`)**: Public informational portal without role cards or interactive demo jump buttons. Top-right authentication buttons in the Navbar provide access to login and registration.
- **Registration (`/register`)**: Technical college registration requiring college name, official email, mobile, telephone, state, password (min 8 chars, not equal to email), confirm password, and 6-digit OTP verification via Nodemailer. OTP is stored solely as a SHA-256 hash with a 10-minute expiry, 60s resend cooldown, 5 failed attempts lockout, and enumeration-safe responses. Passwords hashed with bcrypt; `INSTITUTION_REGISTERED` entries recorded in the SHA-256 ledger (IDs only).
- **State to Region Mapping**: Indian states and union territories deterministically map to AICTE regional offices (Northern, North-Western, Central, Western, Eastern, Southern, South-Western, South-Central) via `backend/src/config/states.ts`.
- **Login (`/login`)**: Email, password, and role selection dropdown (`INSTITUTION`, `OFFICER`, `COMMITTEE`, `CHIEF`). Server verifies the chosen dropdown role against the account's actual role and rejects mismatches with a generic error to prevent role or account enumeration.
- **Institution Profile (`/institution/profile`)**: Mandatory prerequisite before creating applications. Saved as draft and editable until submitted:
  - College details (name, address, PIN, state, district).
  - Contact person (name, designation, mobile, email).
  - Trust / Society / Committee (name, registration number, member repeater with ID proof).
  - Bank credentials: encrypted at rest with AES-256-GCM (`BANK_ENCRYPTION_KEY`), rendered with masked account numbers (`••••••••1234`), and excluded from ledger proofs, logs, and emails.
  - Security Deposit FDR: number, bank, amount, issue & maturity dates, and PDF upload.
  - Land ownership: `OWNED` vs `RENTED` toggle with state-specific required documents (`backend/src/config/landDocuments.ts`).
  - Document uploads: PDF-only magic bytes (`%PDF-`) verification, 10MB limit, SHA-256 hash calculation, stored via storage layer.
- **Backend Checks on Submit**: OCR extraction runs on all documents, comparing declared vs extracted values (name, land area, lease dates, FDR validity), flags expired or conflicting items, and dispatches a review task to the regional scrutiny officer.
- **Document Risk Score Engine**: Multi-signal scoring engine (0 to 100, `LOW`/`MEDIUM`/`HIGH`) checking duplicate document hashes across institutions, suspicious PDF editing software signatures (Canva, Photoshop, Illustrator, PDF24), declared vs extracted conflicts, odd/expired dates, and low extraction confidence.
- **Officer Review Determinations**: Officers review profiles and inspect risk indicators labeled `"risk indicators, not proof"` (system never auto-rejects or blocks). Officers record `NO_CONCERN`, `ASK_CLARIFICATION`, or `REFER` with mandatory remarks, immutably recorded in the ledger.

## Safeguard

Automated actions support the approval process and do not replace decisions of the competent authority. The current build enforces a human sign-off gate before rejection, requires a recorded reason and category for every return, records overrides with remarks in the ledger, and shows a human-decision safeguard notice on officer advance/review, committee EVC report, case-summary, and verification queue screens. Route, stage, undertaking, and renewal settings remain placeholders pending the APH.

## PS Compliance

| Area | Key requirement | Status | Notes |
| :--- | :--- | :--- | :--- |
| A | Routing and return/revert | Built with placeholders | The four PS routes, canonical stage sequences, route-aware progression, guarded return targets/categories, standard notices and read-only case summary exist. Route policy approval is pending the APH. |
| B | Pendency dashboards | Built with placeholders | Route-derived stage SLA config, role-scoped dashboards, ageing buckets, workload, bottlenecks and On time / Approaching / Overdue status exist. Values are placeholders pending the APH. |
| C | Visibility and EVC status | Built with placeholders | EVC board buckets (awaiting, scheduled, completed, delayed), scoped reads, delayed-case alerts and ledger writes exist. Timelines are placeholders pending the APH. |
| D | Undertakings | Built with placeholders | Conditional commitments, evidence intake with SHA-256 ledger recording, daily overdue job, reminder & escalation alerts, and officer verification queue scoped by role & region. |
| E | Renewals | Built with placeholders | Expiring & expired document renewals, officer verification queue, validity date extension, and automatic application unlocking once all overdue documents are cleared. |
| F | Reports and demo data | Not built | Part 6 will add six filtered reports, CSV export, searchable audit view and a larger demo seed. |
| Safeguard | Human authority and recorded reasons | Built for all decision screens | Rejection sign-off, return reasons/categories, override remarks, and evidence rejection remarks + sign-off checks with universal `SafeguardNotice`. |
| Audit | Every state change and alert in ledger | Built | State changes, returns, notices, alerts, evidence submissions, verifications, rejections, escalations, closures, and application unlocks write ledger entries. |

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
