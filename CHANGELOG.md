# Changelog

## 2026-10-26 - Part 4: undertakings and renewals

### Added

- Data model and Drizzle migration `0001_undertakings_renewals.sql` for `undertakings`, `evidence`, and `verifications`, plus renewal columns in `compliance_documents`.
- Full dual-store implementation in both in-memory store and Postgres/Neon store with identical method contracts and tests.
- Undertaking duration and renewal validity period config (`backend/src/config/undertakings.ts`), marked "placeholder pending APH".
- Institution undertakings view, evidence upload with SHA-256 calculation, and document renewal submission with file validation (PDF/PNG/JPG ≤ 10MB).
- Regional officer verification queue (`GET /officer/verification-queue`) scoped by role and region, with evidence verify and reject handlers.
- Rejection safeguards: rejection of undertakings and document renewals requires non-empty recorded remarks and an existing confirmed sign-off on the application.
- Document renewal verification: updates document validity period, re-evaluates compliance status, automatically releases compliance locks on locked applications, and logs to ledger.
- Daily cron automation (`/cron/expiry-check`) marks expired undertakings `OVERDUE`.
- Reminder and escalation alert integration with real undertaking due dates, maintaining idempotency (0 duplicates on subsequent runs).
- Immutable ledger audit entries for all submissions, verifications, rejections, escalations, closures, and application unlocks.
- Complete test suite (`backend/src/__tests__/undertakings.test.ts`) covering full lifecycle, overdue automation, escalation tiers, idempotency, application unlock, role/region scoping boundaries, and rejection safeguards (156 total backend tests passing across 13 test files).
- Frontend UI in institution drawer (Undertakings tab, renewal uploads) and officer portal (Verification Queue tab, rejection modal with visible `SafeguardNotice`).

## 2026-10-26 - Part 3: pendency dashboards and EVC board

### Added

- Route-derived placeholder stage SLA config (`sla-config.ts`) with age in days, days left, On time / Approaching / Overdue status, and ageing buckets.
- Role-scoped `/dashboards/pendency` and `/dashboards/evc-board` endpoints with counts by stage and region, workload, bottlenecks and a filterable pending-cases list.
- Labelled demo data top-up (`APP-DEMO-*`) for missing stages and a delayed EVC case, copied into Postgres seed.
- Delayed EVC cases and approaching/overdue stage timelines feed the existing alert engine and write ledger entries without duplicate cron dispatches.
- Frontend pendency dashboard and EVC board pages using the authenticated API helper, status chips, filters, safeguard notice and a visible "placeholder timelines pending APH" note.

### Changed

- Login lands each role on the matching dashboard view. Dashboard reads are scoped by the same role/region rules as the rest of the API.

### Verified

- Backend typecheck and tests are recorded in the README after this commit.

## 2026-10-26 - Part 2b: four PS approval routes

### Added

- Replaced the earlier type-named routes with the four PS routes: `ONLY_SCRUTINY`, `SCRUTINY_EVC`, `EVC_SAC_SHC` and `ONLY_EVC`.
- Added canonical ordered stage lists for all four routes. `EVC_SAC_SHC` includes the existing `APPEAL_SHC -> APPEAL_SAC` order.
- Added application-type mapping (`NEW -> SCRUTINY_EVC`, `EXTENSION_OF_APPROVAL -> ONLY_SCRUTINY`, `INTAKE_CHANGE -> ONLY_EVC`, `APPEAL -> EVC_SAC_SHC`) and a status override that also selects `EVC_SAC_SHC` for rejected/appeal cases.
- Added route-aware next-stage validation so a globally valid transition is still rejected when it does not belong to the selected route.
- Added reusable `RouteSequence` UI showing route name, route id and the full configured stage sequence on the institution application drawer, officer advance modal and case summary.
- Added end-to-end tests for all four routes, including `EVC_SAC_SHC` selected as a first-class `APPEAL` application type, route-aware invalid transitions, return category/reason enforcement and the case-summary route sequence.

### Changed

- Scrutiny/extraction outcomes now follow route configuration instead of hard-coding `NEW`.
- Updated README, architecture, assumptions and changelog for the four PS routes.

### Verified

- Backend typecheck (`npm run build`) passed.
- Backend tests passed: **129/129** across 10 files.
- Frontend production build passed.
- Frontend API handling reviewed: HTTP 401/403/4xx/5xx responses raise `ApiError` and do not trigger demo-data fallback; local demo data is used only on network/timeout failures, with the demo banner shown.
- No schema migration was needed.

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
