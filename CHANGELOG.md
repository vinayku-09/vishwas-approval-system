# Changelog

## 2026-10-26 - Part 2: routes, returns, notices and case summary

### Added

- Placeholder approval-route configuration for new approval, extension, intake change and appeal in `backend/src/config/routes.ts`, with application-type mapping, stage order, return targets and return categories.
- Routing service for current stage, configured automatic next stage, return options and response decoration with route metadata. Route metadata is derived, not persisted.
- Automatic progression for `SUBMITTED`, `DEFICIENT`, `SCRUTINY` and `EVC_DONE` when `to` is omitted; human action remains mandatory from `EVC_REQUIRED`, `DECISION` and appeal stages.
- `POST /applications/:id/return` with officer/CHIEF role, region scope, configured target validation, category, recorded reason, `APPLICATION_RETURNED` ledger entry and institution notice.
- Standard return and decision notices with in-app notifications and `NOTICE_ISSUED` ledger entries.
- `GET /applications/:id/route` and scoped read-only `GET /applications/:id/case-summary` with route, timeline, returns, sign-off, documents, compliance, inspections, notices and ledger verification.
- Officer return modal, configured target display, optional automatic-next action, and read-only `/case/[id]` summary page linked from officer and institution views.
- Reusable `SafeguardNotice` on officer advance/review, committee EVC report and case-summary screens.
- Part 2 routing tests covering route mapping, auto progression, return validation/scoping, notices, ledger writes and case-summary access. Backend suite is **120/120** across 10 files.

### Changed

- Application responses now include `route`, `returns` and `lastReturn`.
- Officer advance uses route-configured next statuses and can omit an explicit target for configured automatic transitions.
- README, architecture, assumptions and compliance table document the new routes and remaining APH placeholders.

### Verified

- Backend typecheck (`npm run build`) passed.
- Backend tests passed: **120/120** in 10 files.
- Frontend production build passed (9/9 pages generated), including dynamic `/case/[id]`.
- No schema migration was needed; return records use the existing application JSONB payload.

## 2026-10-26 - Part 2a: scoped reads and honest API errors

### Changed

- Frontend demo fallback now triggers only on network-level failures. Any HTTP response clears demo mode, and 401/403/4xx/5xx errors are surfaced as `ApiError` instead of silently showing seed records.
- Application list, detail, document, inspection and ledger reads now require authentication and enforce role/region scope through shared `services/access.ts` rules.
- Institution application creation always uses the authenticated institution name.
- Public ledger verification remains unauthenticated and returns validity metadata only; full ledger reads require scope, and the tamper helper is CHIEF-only.
- Officer, institution, committee and verification pages now display load errors instead of failing silently; the verify page shows a sign-in prompt for the full audit trail.
- Demo banner copy now explains that demo data is used only when the backend is unreachable.
- Added 10 authenticated scoping tests; backend suite is **107/107** across 9 files.

### Verified

- Backend typecheck (`npm run build`) passed.
- Frontend production build passed with 9/9 static pages.
- Scope tests cover INSTITUTION own-only, OFFICER WEST, OFFICER ALL, COMMITTEE WEST, CHIEF, inspections, documents, ledger reads and CHIEF-only tamper.

## 2026-10-26 - Step 0: Phase 1 verification

### Added

- Active-store startup log for Postgres versus in-memory mode.
- Optional `ALERT_EMAIL_OVERRIDE` delivery redirection for demo and test inboxes.
- Unit tests for alert recipient override resolution.
- Refreshed README with feature status, PS compliance table, environment variable names and deployment checklist.
- Updated architecture documentation.
- Added assumptions/placeholders register.

### Verified

- Neon migration: 12 public tables plus Drizzle migration metadata.
- Deterministic seed: 15 applications, 7 users, 2 documents, 3 inspections, 30 ledger entries, 2 notifications.
- Postgres store selection and seeded login persistence.
- `ALLOW_DEMO_HEADER_ROLE=false` rejects demo headers without a JWT.
- Ethereal alert delivery, in-app notification, ledger entry and preview URL.
- Cron idempotency: second run created 0 alerts and skipped 37 duplicates.
- Backend typecheck and **97/97** tests.
- Frontend production build.

### Notes

- No deployment was performed.
- Timelines and escalation delays remain placeholders pending the APH.
- Live SMTP and the Python OR-Tools service remain unverified.
