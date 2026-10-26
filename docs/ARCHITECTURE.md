# Vishwas Architecture

## 1. Overview

Vishwas is the AICTE approval-workflow and compliance-monitoring platform for SIH 2026 problem statement **SH26262**. The monorepo contains a Next.js portal, a Hono API, a Python OR-Tools optimizer service, and shared documentation.

```text
Institution / Officer / Committee / Chief
                  |
                  v
        Next.js frontend (JWT session)
                  |
                  v
        Hono backend API (TypeScript)
        | auth + role scoping
        | workflow state machine
        | document intake + hashing
        | alerts + escalation engine
        | ledger hash chain
                  |
        +---------+----------+
        |                    |
   Neon Postgres       Vercel Blob or local
   (Drizzle)           upload storage
```

All timelines, reminder tiers and escalation delays in the current build are placeholders pending the Approval Process Handbook (APH). They are not official AICTE rules.

## 2. Module Map

### Frontend

- `frontend/src/app/` - Next.js App Router pages: home, login, institution, officer, committee, alerts, public ledger verification.
- `frontend/src/lib/api.ts` - API client, JWT/session handling, demo fallback and demo-account metadata.
- `frontend/src/lib/mock.ts` - clearly labelled local demo data used when the API is unavailable.
- `frontend/src/components/` - navigation, demo badge, notification bell and shared UI.

### Backend

- `backend/src/app.ts` - Hono app, CORS, health and route mounting.
- `backend/src/routes/` - auth, applications, documents, scheduling, cron, notifications, escalations and ledger endpoints.
- `backend/src/middleware/auth.ts` - JWT validation, role claims and optional legacy demo-header fallback.
- `backend/src/services/` - workflow, rules, extraction, storage, scheduler, alerts, mailer, expiry and ledger logic.
- `backend/src/db/` - Drizzle schema, in-memory repository, Postgres repository, migration seed and store selection.
- `backend/src/config/` - central timeline, alert and escalation constants.
- `backend/drizzle/` - generated SQL migrations.

### Optimizer

- `optimizer/api/optimize.py` - FastAPI/OR-Tools vehicle-routing service for EVC inspection scheduling.
- The backend currently falls back to `backend/src/services/optimizerFallback.ts` when `OPTIMIZER_URL` is unset.
- The Python service was not run in Step 0; only the TypeScript fallback is verified by tests.

## 3. Data Model

The Postgres schema contains 12 application tables plus Drizzle migration metadata:

| Table | Purpose |
| :--- | :--- |
| `applications` | Application identity, workflow status, region, type, SLA dates, route fields when added in Part 2 |
| `users` | Seeded and future accounts, role, region, institution and password hash |
| `documents` | Uploaded file metadata and SHA-256 hashes |
| `compliance_documents` | Expiry tracking, warning tiers and locked-application inputs |
| `inspections` | EVC inspection assignments, schedule and report state |
| `inspectors` | Inspector profile, domain, location and availability |
| `affiliations` | Conflict-of-interest records used before routing |
| `ledger` | Immutable hash-chained audit entries |
| `signoffs` | Officer confirmation/override decisions before rejection |
| `notifications` | In-app alerts with role/region scope and idempotency keys |
| `alert_logs` | Reminder and escalation dispatch log with mail status |
| `escalations` | Escalation lifecycle (`OPEN`, `ACKNOWLEDGED`, `RESOLVED`) |

Application, user and alert records use typed JSON payloads for the current prototype. The data model will evolve in Parts 2, 3 and 4 for routes, stage SLAs, undertakings and renewals.

## 4. Configuration Locations

| Concern | Location | Status |
| :--- | :--- | :--- |
| SLA windows and warning threshold | `backend/src/config/timelines.ts` | Placeholder pending APH |
| Expiry warning tiers | `backend/src/config/timelines.ts` | Placeholder pending APH |
| Scrutiny rule thresholds | `backend/src/config/timelines.ts` | Placeholder pending APH |
| EVC inspection duration, hours, travel speed, winding factor | `backend/src/config/timelines.ts` | Prototype assumption |
| Reminder offsets and escalation matrix | `backend/src/config/alerts.ts` | Placeholder pending APH |
| Route definitions and application-type mapping | Planned for Part 2 | Not built |
| Stage-level SLA and ageing buckets | Planned for Part 3 | Not built |
| Renewal validity periods | Planned for Part 4 | Not built |

Every value above is a product placeholder, not an official AICTE rule. See `docs/assumptions.md` for the current values.

## 5. Authentication and Scoping

1. The frontend stores a signed JWT returned by `POST /auth/login`.
2. `authMiddleware` verifies the token and attaches role, region, institution and inspector claims.
3. Signed-token claims take precedence over legacy demo headers.
4. When `ALLOW_DEMO_HEADER_ROLE=false`, an `x-role` header without a JWT is rejected. Step 0 verified HTTP 401.
5. Notification and escalation reads filter by role and region. Institution users see only their own records; regional officers see their region; `CHIEF` sees all.
6. `services/access.ts` centralises application scope: `CHIEF` and `ALL` regions are unrestricted, regional `OFFICER`/`COMMITTEE` users see their own region plus legacy `ALL`/unset regions, and `INSTITUTION` users see only their own institution.
7. Application list/detail/mutations, document reads and uploads, inspection listings and full ledger reads use that scope. `GET /ledger/:id/verify` stays public and returns validity metadata only; `POST /ledger/:id/tamper` is `CHIEF`-only.
8. The frontend falls back to local demo data only when the backend is unreachable. HTTP errors are surfaced to the user and never converted into demo records.

## 6. Workflow and Human Control

The current workflow enforces valid transitions through a deterministic state machine. Rejection requires a recorded officer `CONFIRM` sign-off. Overrides require remarks. Automated checks never perform a final rejection on their own.

Part 2 will add configurable routes, automatic stage progression, return/revert actions with reason and category, and a read-only electronic case summary.

## 7. Alert Flow

```text
Daily cron -> build open alert items -> apply reminder offsets / escalation matrix
           -> claim idempotency key in alert_logs
           -> create in-app notification
           -> write ledger entry
           -> send email through mailer
           -> update mailStatus (SENT / FAILED / SKIPPED)
```

- Reminder offsets and escalation levels are keyed by `${eventId}:${kind}:${level}`.
- The database unique key makes overlapping cron runs safe.
- Email modes are `log` (default), `ethereal` (test preview) and `live` (SMTP).
- `ALERT_EMAIL_OVERRIDE` can redirect all demo alert mail to one test inbox while the original role recipient remains in the alert log.
- Step 0 verified 37 dispatches, 0 failures and 37 duplicates skipped on the second run.

## 8. Ledger Flow

Every state change, verification, alert and closure writes an append-only entry:

```text
hash = SHA-256(previousHash + canonicalJSON(entryFields))
```

The ledger endpoint recomputes the chain and reports the first broken block if tampering is detected. Step 0 verified `APP-2024-005` with `valid: true` and all four blocks intact.

## 9. Current Gaps

- Part 2 routing, return/revert, notices and case summary are not built.
- Part 3 dashboards and stage SLA configuration are not built.
- Part 4 undertakings and renewals are not built.
- Part 6 reports, audit search and expanded demo data are not built.
- Live SMTP was not verified.
- Python OR-Tools was not run or deployed.
- Role/region scoping for all read endpoints needs a security pass before deployment.
- The universal decision-screen safeguard notice is not yet applied everywhere.
