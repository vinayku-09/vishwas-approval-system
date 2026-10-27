# Changelog

## 2026-10-27 - Vercel Blob Storage Mode & Secure File Serving

### Added

- **Multi-mode file storage layer** (`STORAGE_MODE=local|postgres|blob`):
  - `backend/src/storage/fileStorage.ts` – shared `IFileStorage` interface, `isValidPdfMagicBytes`, `sha256hex`, size constants (`MAX_FILE_BYTES=10 MB`, `SERVER_UPLOAD_MAX_BYTES=4.5 MB`), and `buildPathname` helper.
  - `backend/src/storage/localFileStorage.ts` – writes files to `UPLOAD_DIR` (default `./uploads`), reads back as `Buffer`, re-verifies SHA-256 on every read.
  - `backend/src/storage/postgresFileStorage.ts` – stores base64-encoded bytes in the JSONB `data` column; `getRecord()` strips the `bytesBase64` field before returning metadata to callers.
  - `backend/src/storage/blobStorage.ts` – Vercel Blob backend using `access:'private'`, `addRandomSuffix:true`, pathname `institutions/{institutionId}/{kind}/{uuid}.pdf`. SHA-256 computed before upload; stored pathname used for streaming via `get()`.
  - `backend/src/storage/index.ts` – singleton factory; `resetFileStorage()` exported for testing.
- **Secure file serving route** (`backend/src/routes/files.ts`):
  - `POST /files` – server-side upload with PDF magic-byte check, size limit enforcement (413 for files > 10 MB; 413 + redirect message for files > 4.5 MB in blob mode), SHA-256 computed pre-upload.
  - `POST /files/upload-token` – auth-gated endpoint returning upload configuration for large-file client uploads (blob mode only).
  - `GET /files/:id` – authenticates caller, enforces role/region scope (CHIEF=all, OFFICER/COMMITTEE=region, INSTITUTION=own files by `sub`), re-verifies SHA-256 hash against stored value (returns **409** on mismatch), sets `Cache-Control: private, no-store`, streams file. No public URLs ever exposed.
  - `DELETE /files/:id` – DRAFT-only deletion (returns 409 if `isDraft=false`). Submitted evidence is never deleted server-side.
- **DB schema** (`backend/src/db/schema.ts`): `stored_files` Postgres table with columns `id`, `pathname`, `sha256`, `size`, `content_type`, `institution_id`, `region`, `is_draft`, `uploaded_at`, and `data` (JSONB). Indexes on `institution_id`, `region`, `sha256`, and `pathname`.
- **Repository interface** (`IStore`): `saveFileRecord`, `getFileRecord`, `deleteFileRecord`, `listFileRecords` added to both `InMemoryStore` and `PostgresStore`.
- **New env vars** (see `.env.example`):
  - `STORAGE_MODE=local|postgres|blob` (default: `local`)
  - `BLOB_READ_WRITE_TOKEN` – server-only, never committed or sent to client
  - `UPLOAD_DIR=./uploads` – local storage base directory
- **Test suite** (`backend/src/__tests__/file_storage.test.ts`): 43 tests covering all three storage modes (local, postgres, blob with mocked `@vercel/blob`), `isValidPdfMagicBytes`, SHA-256 integrity, DRAFT-only deletion, and `GET /files/:id` route (401, 403 region scope, 404, 409 hash mismatch, 200 streaming). Full suite: **253 passed / 253**.

## 2026-10-27 - Proposed Courses & Intake Module

### Added

- **Data Models & Database Migration (`course_proposals`, `proposed_branches`)**:
  - Drizzle Postgres tables `course_proposals` and `proposed_branches` with indexes (`0002_course_proposals.sql`), mapped to both Postgres/Neon and in-memory repository with zero-downtime consistency.
  - Supports proposal types `NEW_INSTITUTION`, `EOA`, `NEW_COURSE`, `INTAKE_INCREASE`, and `CLOSURE` with lifecycle statuses `DRAFT`, `SUBMITTED`, and `REVIEWED`.
  - Proposed branch schema tracking level (`UG`, `PG`, `DIPLOMA`), program, course, affiliating body, current/expected intake, shifts, cadre sanction & availability, pay compliance, lab rosters, built-up area, and university affiliation NOCs.
- **AICTE Normative Thresholds Configuration (`backend/src/config/courseNorms.ts`)**:
  - Threshold parameters: faculty:student ratios (UG 1:20, PG 1:15, Diploma 1:25), minimum land area per student intake (5 sqm/intake), laboratory minimums (4 labs/branch), minimum instructional built-up area (400 sqm/branch), standard approved division intake increments (`[30, 60, 120, 180, 240, 300]`), and single-cycle maximum intake increase ceiling (+60 seats).
  - Every individual threshold value explicitly labeled with `"placeholder pending APH. Not official."`.
- **Pure Evaluation Engine (`backend/src/services/branchCheck.ts`)**:
  - Pure function returning rule outcomes `{ rule, status: 'MET' | 'DEFICIENT' | 'REVIEW', computed, required, reason }` across all 7 statutory dimensions:
    1. `FACULTY_RATIO`: computes required faculty vs available against normative ratios.
    2. `FACULTY_PAY_COMPLIANCE`: flags pay scale non-compliance and unfilled sanctioned cadre vacancies.
    3. `LAND_SUFFICIENCY`: computes required campus area across cumulative proposed intake against reused institutional profile land records.
    4. `LABS_INFRASTRUCTURE`: evaluates departmental lab counts, instructional built-up square meters, and library access.
    5. `AFFILIATION_NOC`: validates mandatory university or state technical board affiliation NOC declarations.
    6. `INTAKE_LIMIT`: verifies standard division increments and enforces the +60 seat single-year ceiling.
    7. `DOCUMENT_VALIDITY`: reuses existing expiry monitor (`computeExpiryState`) to detect expired or impending document deadlines.
  - **Critical Safeguard Principle**: Automated checks serve strictly as assistive indicators for officers and **never auto-reject or block** application submission.
- **API Routing & Scoping (`/proposals`, `backend/src/routes/proposals.ts`)**:
  - `POST /proposals`: creates draft proposals with dynamic normative check summaries.
  - `GET /proposals`: scoped by role and region (Institutions see own proposals; Regional Officers see assigned jurisdiction; Chief sees all).
  - `GET /proposals/:id`: retrieves single proposal with live re-calculated check results.
  - `PATCH /proposals/:id`: allows draft modifications; locks once submitted.
  - `POST /proposals/:id/submit`: non-blocking submission regardless of check deficiencies; writes `COURSE_PROPOSAL_SUBMITTED` event to audit ledger.
  - `POST /proposals/:id/determination`: officer review endpoint (`NO_CONCERN`, `ASK_CLARIFICATION`, `REFER`) requiring mandatory non-empty remarks and enforcing regional scoping; writes `COURSE_PROPOSAL_REVIEWED` event to ledger.
  - **Cryptographic Ledger Invariant**: All ledger events record entity IDs and SHA-256 hashes only (`branchesHash`, `checkResultsHash`, `remarksHash`), strictly excluding raw PII and unhashed text.
- **Frontend Modules**:
  - `/institution/proposals`: Course proposal builder with branch repeater, live side-by-side normative check panel, profile land reuse badge, save draft, and non-blocking submission.
  - Officer Portal tab: Course & Intake Proposals queue with prominent **"Indicators, not decisions"** safeguard notice, full branch inspection breakdown, and official determination modal.
- **Automated Test Suite (`backend/src/__tests__/course_proposals.test.ts`)**:
  - 15 comprehensive automated tests covering all 7 normative rules, scoping boundaries, mandatory remarks enforcement, non-blocking submit guarantees, and cryptographic ledger hashing.
  - Backend test suite expanded to **210 passed out of 210 tests** across 16 test files.
  - Frontend production build: 19 routes statically and dynamically compiled with 0 errors.

## 2026-10-27 - Part 6: reports, audit-trail view, configuration, and comprehensive demo seed

### Added

- **Reports Suite (`/reports`, `GET /reports`, `GET /reports/:type`)**:
  - Six comprehensive MIS reports: Application Pendency, EVC Status, Undertaking Compliance, Document Validity & Renewals, Overdue Cases & Escalations, and Region-Wise Performance (average days per stage, overdue rate, returns).
  - Multi-dimensional filters: Region (All, North, South, East, West, Central, North East), From Date, To Date, and live row search.
  - Role- and region-based backend scoping via `canReadApplication` (Head Office / Chief sees all, Regional Officers see assigned jurisdiction, Institutions see own applications).
  - RFC 4180 compliant CSV export engine supporting both `?format=csv` and `Accept: text/csv` headers with direct client download.
  - Interactive preview table with formatted cells, status chips, dynamic column rendering, and summary KPI cards.
- **Head-Office Audit-Trail View (`/audit`, `GET /ledger`)**:
  - Queryable append-only audit trail filtered by event type, actor, region, date range, and application ID.
  - Cryptographic ledger verification on every row (`verifyLedgerChain`), confirming valid unbroken hash chains or alerting on integrity breaches.
  - Modal block inspector displaying previous hash, current block SHA-256 hash, actor, timestamp, and tamper-evident payload.
- **Read-Only System Configuration (`/configuration`, `GET /config`)**:
  - Head-office governance view displaying approval routes, stage timeline SLAs, reminder warning tiers (90/60/30 days), hierarchical escalation matrix (Levels 1, 2, 3), and statutory renewal/cure periods.
  - Prominently labeled with `"placeholder pending APH"` across all sections and rows, with explicit statutory notice that parameters require official Gazette publication.
- **Insert-Only Demo Dataset (42 Applications, `backend/src/db/demoSeedPart6.ts`)**:
  - Populates ~42 applications across all 6 administrative regions (`NORTH`, `SOUTH`, `EAST`, `WEST`, `CENTRAL`, `NORTH_EAST`).
  - Covers all 4 approval routes (`ONLY_SCRUTINY`, `SCRUTINY_EVC`, `EVC_SAC_SHC`, `ONLY_EVC`).
  - Covers all 10 workflow stages (`SUBMITTED` through `APPEAL_SAC`), return records across 5 categories, SLA states (on-time, approaching, overdue), undertakings across all 5 statuses (`PENDING`, `SUBMITTED`, `VERIFIED`, `REJECTED`, `OVERDUE`), document validity warning tiers (90d, 60d, 30d, expired with system lock), renewals (`SUBMITTED`, `VERIFIED`, `REJECTED`), delayed EVC visits, and active escalations (Levels 1-3).
  - Strictly insert-only (filters existing IDs before insert), zero real personal data, labelled with synthetic test markers.
- **Institution Registration & Email Verification (`/register`, `/verify-email`, `POST /auth/register`, `GET /auth/verify-email`)**:
  - Self-service registration for technical institutions requiring 10+ character passwords, email uniqueness checks, and in-memory rate limiting (5 attempts / 15m).
  - 24-hour cryptographic token-based email verification workflow; unverified institution accounts are gated from login with HTTP 403.
  - Automated transactional notification emails via Nodemailer with SHA-256 ledger recording.
- **Institution Return Reply Workflow (`POST /applications/:id/reply-return`)**:
  - Allows institutions to submit clarification remarks against active return notices.
  - Updates application return reply state and records immutable `RETURN_REPLIED` entry on the SHA-256 audit ledger.
- **Head-Office User Management (`GET /auth/users`, `POST /auth/users`)**:
  - Scoped to `CHIEF` role, allowing administrative creation of regional officers and committee inspectors with assigned jurisdictions.
- **Database Reset Safety Guard (`ALLOW_DB_RESET=true`)**:
  - Reset CLI command (`npm run db:reset`, `backend/src/db/reset.ts`) and store `resetDatabase()` methods refuse execution unless `process.env.ALLOW_DB_RESET === 'true'`.
- **Compliance Register (`docs/PS_COMPLIANCE.md`)**:
  - Comprehensive formal compliance record mapping Areas A through F, architectural safeguards, test results, and honest disclosures of draft/partial items.
- **Automated Test Suite**:
  - Total test suite: **180 passed out of 180 tests** across 14 test files (including 18 reports tests, 33 auth tests with registration/verification coverage, and 14 access/scoping tests).
  - Frontend production build: compiled and statically optimized with 0 errors across all 17 routes.


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
