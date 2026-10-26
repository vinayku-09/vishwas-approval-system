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

- `frontend/src/app/` - Next.js App Router pages: home, login, institution, officer, committee, alerts, pendency dashboard, EVC board, public ledger verification and read-only case summary (`case/[id]`).
- `frontend/src/lib/api.ts` - API client, JWT/session handling, demo fallback and demo-account metadata.
- `frontend/src/lib/mock.ts` - clearly labelled local demo data used when the API is unavailable.
- `frontend/src/components/` - navigation, demo badge, notification bell, shared UI and `SafeguardNotice`.

### Backend

- `backend/src/app.ts` - Hono app, CORS, health and route mounting.
- `backend/src/routes/` - auth, applications, documents, scheduling, cron, notifications, escalations, ledger and dashboard endpoints.
- `backend/src/middleware/auth.ts` - JWT validation, role claims and optional legacy demo-header fallback.
- `backend/src/services/` - workflow, routing, notices, rules, extraction, storage, scheduler, alerts, mailer, expiry, ledger, pendency and dashboard logic.
- `backend/src/db/` - Drizzle schema, in-memory repository, Postgres repository, migration seed and store selection.
- `backend/src/config/` - central timeline, alert, escalation, route and placeholder stage-SLA constants.
- `backend/drizzle/` - generated SQL migrations.

### Optimizer

- `optimizer/api/optimize.py` - FastAPI/OR-Tools vehicle-routing service for EVC inspection scheduling.
- The backend currently falls back to `backend/src/services/optimizerFallback.ts` when `OPTIMIZER_URL` is unset.
- The Python service was not run in Step 0; only the TypeScript fallback is verified by tests.

## 3. Data Model

The Postgres schema contains 12 application tables plus Drizzle migration metadata:

| Table | Purpose |
| :--- | :--- |
| `applications` | Application identity, workflow status, region, type, SLA dates and JSONB route/return fields |
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

Application, user and alert records use typed JSON payloads for the current prototype. Route metadata is resolved from application type at response time and is not persisted. Return records (`returns`, `lastReturn`) live in the existing application JSONB payload, so Part 2 did not add a table or migration. Stage SLA values used by Part 3 dashboards are derived from the four PS route stage lists at runtime and are not persisted. The data model will evolve in Part 4 for undertakings and renewals.

## 4. Configuration Locations

| Concern | Location | Status |
| :--- | :--- | :--- |
| SLA windows and warning threshold | `backend/src/config/timelines.ts` | Placeholder pending APH |
| Expiry warning tiers | `backend/src/config/timelines.ts` | Placeholder pending APH |
| Scrutiny rule thresholds | `backend/src/config/timelines.ts` | Placeholder pending APH |
| EVC inspection duration, hours, travel speed, winding factor | `backend/src/config/timelines.ts` | Prototype assumption |
| Reminder offsets and escalation matrix | `backend/src/config/alerts.ts` | Placeholder pending APH |
| Route definitions, application-type mapping, return targets and categories | `backend/src/config/routes.ts` | Placeholder pending APH |
| Stage-level SLA days, approaching threshold and ageing buckets | `backend/src/config/sla-config.ts` | Placeholder pending APH |
| Renewal validity periods | Planned for Part 4 | Not built |

Every value above is a product placeholder, not an official AICTE rule. See `docs/assumptions.md` for the current values.

## 5. Authentication and Scoping

1. The frontend stores a signed JWT returned by `POST /auth/login`.
2. `authMiddleware` verifies the token and attaches role, region, institution and inspector claims.
3. Signed-token claims take precedence over legacy demo headers.
4. When `ALLOW_DEMO_HEADER_ROLE=false`, an `x-role` header without a JWT is rejected. Step 0 verified HTTP 401.
5. Notification and escalation reads filter by role and region. Institution users see only their own records; regional officers see their region; `CHIEF` sees all.
6. `services/access.ts` centralises application scope: `CHIEF` and `ALL` regions are unrestricted, regional `OFFICER`/`COMMITTEE` users see their own region plus legacy `ALL`/unset regions, and `INSTITUTION` users see only their own institution.
7. Application list/detail/mutations, document reads and uploads, inspection listings, full ledger reads and `/dashboards` endpoints use that scope. Regional officers see their region; bureau officers, committee and head office follow the same existing rules; institutions see only their own applications. `GET /ledger/:id/verify` stays public and returns validity metadata only; `POST /ledger/:id/tamper` is `CHIEF`-only.
8. The frontend falls back to local demo data only when the backend is unreachable. HTTP errors are surfaced to the user and never converted into demo records.

## 6. Workflow and Human Control

The current workflow enforces valid transitions through a deterministic state machine. Rejection requires a recorded officer `CONFIRM` sign-off. Overrides require remarks. Automated checks never perform a final rejection on their own.

Routes are derived at response time from application type, with a status override for rejections and appeals:

- `ONLY_SCRUTINY` (`EXTENSION_OF_APPROVAL`): `SUBMITTED -> SCRUTINY -> DECISION`.
- `SCRUTINY_EVC` (`NEW`): `SUBMITTED -> SCRUTINY -> EVC_REQUIRED -> EVC_DONE -> DECISION`.
- `EVC_SAC_SHC` (`APPEAL`; also rejected/appeal statuses): `SUBMITTED -> SCRUTINY -> EVC_REQUIRED -> EVC_DONE -> DECISION -> APPEAL_SHC -> APPEAL_SAC`. The existing state-machine order is SHC then SAC even though the PS short name lists SAC/SHC.
- `ONLY_EVC` (`INTAKE_CHANGE`): `SUBMITTED -> EVC_REQUIRED -> EVC_DONE -> DECISION`.
- These route stage lists are canonical. Part 3 stage-SLA configuration imports them rather than retyping stage names.
- `POST /applications/:id/advance` may omit `to`. The configured automatic next stage is used for `SUBMITTED`, `DEFICIENT`, `SCRUTINY` and `EVC_DONE`. `EVC_REQUIRED`, `DECISION` and appeal stages always require a human-selected target.
- The advance handler rejects a globally valid transition that is not part of the selected route.
- `POST /applications/:id/return` allows only configured earlier targets, requires a category and a recorded reason of at least 10 characters, and is limited to in-scope `OFFICER`/`CHIEF` users.
- Returns and decisions create standard notices. Notices create in-app notifications and `NOTICE_ISSUED` ledger entries; returns also create `APPLICATION_RETURNED`.
- `GET /applications/:id/case-summary` is scoped and read-only. It assembles route, timeline, returns, sign-off, documents, compliance, inspections, notices and ledger verification without mutating state.
- All route and stage settings are placeholders pending the APH.

## 6b. Pendency dashboards and EVC board

- `GET /dashboards/pendency` and `GET /dashboards/evc-board` require a JWT and apply `canReadApplication` scope.
- Role views: regional officer, bureau officer, committee, head office, institution (own applications).
- Pendency rows include ageDays, daysLeft, On time / Approaching / Overdue and ageing buckets. Filters: region, stage, status.
- EVC board buckets: awaiting, scheduled, completed, delayed. Delayed report dates feed the alert engine.
- Stage SLA days, approaching threshold and ageing bucket edges are placeholders pending APH and are shown on the UI.

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
- Approaching or overdue stage timelines and delayed EVC report dates feed this same engine and write `ALERT_REMINDER` / `ALERT_ESCALATION` ledger entries. Duplicate cron runs are skipped.
- `ALERT_EMAIL_OVERRIDE` can redirect all demo alert mail to one test inbox while the original role recipient remains in the alert log.
- Step 0 verified 37 dispatches, 0 failures and 37 duplicates skipped on the second run.

## 8. Ledger Flow

Every state change, verification, alert and closure writes an append-only entry:

```text
hash = SHA-256(previousHash + canonicalJSON(entryFields))
```

The ledger endpoint recomputes the chain and reports the first broken block if tampering is detected. Step 0 verified `APP-2024-005` with `valid: true` and all four blocks intact.

## 9. Current Gaps

- Route mapping, stage order, automatic progression, return targets, notice wording and stage SLA days are placeholders pending APH policy approval.
- Part 3 pendency dashboards and the EVC board are built with placeholder timelines pending APH.
- Part 4 undertakings and renewals are not built.
- Part 6 reports, audit search and expanded demo data are not built.
- Live SMTP was not verified.
- Python OR-Tools was not run or deployed.
- Role/region scoping for all read endpoints needs a security pass before deployment.
- New decision screens must reuse `SafeguardNotice`; this is a code-review rule, not an automated test.
