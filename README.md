# Vishwas Approval System

A full-stack, automated prototype system for AICTE (All India Council for Technical Education) technical institution approvals. **Vishwas** replaces paper-heavy regulatory bureaucracy with verified document uploads, multimodal AI document extraction, deterministic rules scrutiny, human officer sign-off gates, daily compliance expiry monitoring with automated locking, vehicle routing inspector scheduling with conflict-of-interest exclusion, and an append-only SHA-256 cryptographic audit ledger.

---

## 🏛️ System Architecture & Workflow

```
[ Technical Institution ]            [ AICTE Scrutiny Officer ]       [ Daily Cron Scheduler ]
         │                                      │                                  │
  1. Upload Deeds (PDF/PNG)              3. Run AI Scrutiny                 5. Expiry Check
  (Lease deed, Fire NOC)                 (Vision AI / Mock Extraction)      (90/60/30d Warning / Lock)
         │                                      │                                  │
         │                               4. Human Sign-Off                         │
         │                               (CONFIRM / OVERRIDE)                      │
         ▼                                      ▼                                  ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                               Next.js 14 Web Frontend                                  │
│                 Government Portal UI (Tailwind CSS, Responsive, Role Switcher)         │
│                 • Real Document Uploads & Hashes   • Monitored Compliance Badges       │
│                 • Rich Extraction Metrics Table    • Navbar Notification Bell          │
└───────────────────────────────────────────┬────────────────────────────────────────────┘
                                            │ HTTP (JSON / Multipart) + x-role header
                                            ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                                 Hono API Backend                                       │
│          • State Machine (workflow.ts)      • AICTE Rules Engine (rules.ts)            │
│          • Multimodal Extractor (extractor) • Expiry Calculation (expiry.ts)           │
│          • Storage Service (storage.ts)     • SHA-256 Hash Chain (ledger.ts)           │
└───────────────────────────────────────────┬────────────────────────────────────────────┘
                                            │
                                            ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                        Tamper-Evident SHA-256 Cryptographic Chain                      │
│            hash = SHA-256(prevHash + canonicalJSON(id, app, event, actor, payload))     │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 🚀 Quickstart (Zero-Setup Local Dev)

Node.js `v18+` is required. Both backend and frontend run with built-in in-memory fallback stores and sample seed data out of the box with zero external configuration.

### 1. Start the Backend API (Port 4000)

```bash
cd backend
npm install
npm run dev
```

The Hono API will be live at:
- Healthcheck: `http://localhost:4000/health`
- Seeded Applications: `http://localhost:4000/applications`
- Compliance Expiry Check: `http://localhost:4000/cron/expiry-check`
- Alerts & Escalation Run: `http://localhost:4000/cron/alerts` (requires `CRON_SECRET`)
- Cryptographic Ledger: `http://localhost:4000/ledger/APP-2024-001`
- Ledger Verification: `http://localhost:4000/ledger/APP-2024-001/verify`

### 2. Start the Frontend (Port 3000)

In a new terminal window:

```bash
cd frontend
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## ⚙️ Environment Variables & Fallbacks

Both the backend and frontend seamlessly fall back to local in-memory engines when environment variables are omitted:

| Variable | Description | Fallback Behavior when Unset |
| :--- | :--- | :--- |
| `DATABASE_URL` | Neon Postgres connection string | Uses built-in in-memory repository pre-seeded with 4 sample applications |
| `BLOB_READ_WRITE_TOKEN` | Vercel Blob access token for uploaded PDF/PNG files | Stores files safely in local `./uploads/` directory (gitignored) |
| `AI_GATEWAY_API_KEY` | Vercel AI SDK Gateway key for Multimodal Vision extraction | Uses deterministic mock extractor (`source: "mock"`) |
| `EXTRACTION_MODEL` | Vision model ID (e.g. `gpt-4o-mini`, `gemini-1.5-flash`) | Defaults to `gpt-4o-mini` when AI Gateway is enabled |
| `CRON_SECRET` | Bearer token protecting `/cron/expiry-check` and `/cron/alerts` | Expiry check accepts `Bearer dev-cron-secret`; alerts refuse to run (HTTP 503) unless set |
| `MAIL_MODE` | Alert email delivery: `log`, `ethereal` or `live` | Defaults to `log` (prints the message, never sends) |
| `MAIL_FROM` | Sender address for alert emails | `no-reply@vishwas.local` |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASS` | SMTP credentials for `MAIL_MODE=live` | Unused in log/ethereal modes |
| `PORTAL_URL` | Base URL used in alert email links | `http://localhost:3000` |
| `ALLOW_DEMO_HEADER_ROLE` | Enables legacy `x-role` auth fallback for demos | `false` (JWT required) |
| `OPTIMIZER_URL` | Endpoint of the Python Google OR-Tools VRP optimizer microservice | Uses built-in pure TypeScript vehicle routing solver (`optimizerFallback.ts`) with identical constraints |
| `NEXT_PUBLIC_API_URL` | Frontend pointer to backend URL | Defaults to `http://localhost:4000` with offline mock fallback |

---

## 📡 API Contract Reference

All endpoints return standard JSON. Errors return `{ "error": string }`.

| Method | Endpoint | Description | Request Headers / Body |
| :--- | :--- | :--- | :--- |
| `GET` | `/health` | Service liveness healthcheck | None |
| `GET` | `/applications` | List applications (`?status=&type=`) | None |
| `POST` | `/applications` | Create affiliation proposal | `{ institutionName, type, extracted? }` |
| `GET` | `/applications/:id` | Fetch application details | None |
| `POST` | `/applications/:id/documents` | Upload PDF/PNG/JPG ($\le 10$ MB), hash with SHA-256 | Multipart: `file`, `docType` (`LEASE_DEED \| FIRE_NOC \| LAND_RECORD`) |
| `GET` | `/applications/:id/documents` | List uploaded document metadata | None |
| `POST` | `/applications/:id/extract` | Run AI Vision / Mock extraction & evaluate AICTE rules | Header: `x-role: officer` |
| `POST` | `/applications/:id/signoff` | Human officer sign-off (`CONFIRM \| OVERRIDE`) | Header: `x-role: officer`<br>Body: `{ decision, deficiencyIds, remarks }` |
| `POST` | `/applications/:id/advance` | Advance workflow state (enforces sign-off & lock gates) | Header: `x-role: officer`<br>Body: `{ to: Status, remarks?, overrideRemarks? }` |
| `GET` | `/applications/:id/compliance` | Get compliance documents with expiry states & days left | None |
| `POST` | `/scheduling/optimize` | Run OR-Tools / Fallback VRP inspection scheduling (officer) | Header: `x-role: officer`<br>Body: `{ dateWindow: { start, end } }` |
| `GET` | `/inspections` | List assigned EVC inspections (`?inspectorId=`) | None |
| `POST` | `/applications/:id/schedule-evc` | Confirm & record EVC committee assignment | Header: `x-role: officer`<br>Body: `{ inspectorIds: [id1, id2], date }` |
| `POST` | `/applications/:id/evc-report` | Committee files inspection report, advances state to `EVC_DONE` | Header: `x-role: committee`<br>Body: `{ inspectorId, observations, recommendations, passed, metrics }` |
| `POST` | `/cron/expiry-check` | Daily job to recompute expiry tiers (90/60/30) & lock overdue apps | Header: `Authorization: Bearer <CRON_SECRET>` |
| `GET`/`POST` | `/cron/alerts` | Daily reminder + escalation engine (idempotent) | Header: `Authorization: Bearer <CRON_SECRET>` (503 if unset) |
| `GET` | `/escalations` | List escalations (`?status=&eventType=`), region-scoped | Header: `Authorization: Bearer <JWT>` (OFFICER/COMMITTEE/CHIEF) |
| `POST` | `/escalations/:id/acknowledge` | Move escalation to `ACKNOWLEDGED` and write ledger entry | Bearer JWT |
| `POST` | `/escalations/:id/resolve` | Resolve with mandatory remarks and write ledger entry | Bearer JWT; `{ remarks }` |
| `GET` | `/notifications` | List in-app notifications (role/region scoped when authenticated) | Optional Bearer JWT |
| `POST` | `/notifications/:id/read` | Mark in-app alert as read | None |
| `GET` | `/ledger/:applicationId` | Retrieve audit chain blocks | None |
| `GET` | `/ledger/:applicationId/verify` | Verify cryptographic hash chain | None |
| `POST` | `/ledger/:applicationId/tamper` | Test endpoint to simulate DB record alteration | `{ index?: number }` |

---

## 🕒 Daily Expiry Monitor & Automatic Locking

The system includes a daily cron job scheduled via `backend/vercel.json`:
- **Schedule**: Daily at midnight (`0 0 * * *`) calling `/cron/expiry-check`.
- **Warning Tiers**: When a compliance document enters 90, 60, or 30 days of expiry, a `WARNING` notification is dispatched.
- **Idempotency**: Notification and ledger logs utilize compound keys (`${docId}-${tier}`) ensuring zero duplicates on multiple executions.
- **Automatic Lock**: When any compliance document is `OVERDUE` ($\le 0$ days), the application is locked (`locked = true`). Any attempt to advance a locked application returns `HTTP 423` unless an officer provides explicit override remarks recorded in the audit ledger.

---

## 🔒 Human Sign-Off Regulatory Gate

Before an application can be transitioned to `REJECTED`, the regulatory rules mandate human review:
- Attempting to advance to `REJECTED` without an officer `CONFIRM` sign-off returns `HTTP 409 "Officer sign-off required"`.
- Officers can either `CONFIRM` deficiencies or issue an `OVERRIDE` with mandatory justification recorded in the immutable SHA-256 ledger.

---

## 🚗 EVC Inspector Vehicle Routing & Conflict-of-Interest Optimizer (Phase A)

Automates the assignment of Expert Visit Committee (EVC) physical inspections for technical institutes entering `EVC_REQUIRED`:
- **Dual Solver Architecture**:
  - **Python Google OR-Tools Service** (`optimizer/api/optimize.py`): Deployable to Vercel Python runtime using Vehicle Routing with Time Windows (VRPTW).
  - **Built-in TypeScript Fallback Solver** (`backend/src/services/optimizerFallback.ts`): Pure TS heuristic solver executing the identical constraint logic when `OPTIMIZER_URL` is omitted, ensuring 100% zero-setup operability.
- **Strict Pre-Solve Conflict Exclusion**: Affiliations (alumni, prior employment, consulting, family) are completely removed from the candidate pool *before* routing runs, making conflicted assignments mathematically impossible.
  - *Live Demonstration*: Mumbai-based `INS-001` is only 10 km from VJTI Mumbai (`APP-2024-005`), but is barred due to past employment affiliation. The optimizer automatically selects unconflicted experts from Pune (`INS-002`) and Nashik (`INS-003`).
- **Domain Matching & 2-Inspector Teams**: Every institution is assigned exactly 2 distinct inspectors holding qualifications matching the application's domain (e.g. `CIVIL`, `CSE`, `MECHANICAL`, `ELECTRICAL`).
- **Operational Constraints**: Operating hours 09:00 to 18:00 (9 hours max shift), 4.0 hours per on-site inspection, travel speed 40 km/h, road distance modeled as $\text{haversine} \times 1.3$.
- **Efficiency Metrics**: Compares optimized routes against a naive first-fit baseline to calculate total travel km saved and percentage efficiency improvement.
- **Unassigned Visit Diagnostics**: Visibly reports institutions that cannot be scheduled with precise regulatory reasons (e.g. `APP-2024-015` in Leh exceeds the daily 9-hour working shift window due to transit distance).
- **Immutable Ledger Integration**: Writes `EVC_SCHEDULED` (inspector IDs, date, solver source) and `EVC_REPORT_SUBMITTED` (with cryptographic SHA-256 hash of findings, advancing the application to `EVC_DONE`).

---

## 🔔 Reminder & Escalation Engine (Phase C)

A single config file (`backend/src/config/alerts.ts`) drives both reminders and escalations:

- **Reminder offsets**: 30 / 15 / 7 / 1 days before the due date, applied to application pendency, EVC scheduling, EVC report submission, institutional undertakings, document expiry and document authenticity verification.
- **Escalation matrix**: each `{ eventType, level, delayDays, recipientRole, region }` row is raised once its delay has elapsed. Region `ALL` inherits the item's region; a fixed region pins the escalation to that region.
- **Idempotency**: every dispatch is keyed `${eventId}:${kind}:${level}` in the alert log, so rerunning the cron never duplicates a notification, email or ledger entry.
- **Email delivery**: Nodemailer with `MAIL_MODE=log` (default, prints the message), `ethereal` (test inbox + preview URL) or `live` (SMTP). Messages contain ONLY the application id, a one-line reason and a portal link. Sends retry once and record `SENT` / `FAILED` / `SKIPPED`; credentials are never logged.
- **Escalation lifecycle**: `OPEN → ACKNOWLEDGED → RESOLVED`. Resolving requires remarks and writes `ESCALATION_RESOLVED` (plus `ESCALATION_ACKNOWLEDGED`) to the cryptographic ledger.
- **Scoping**: institutions only see their own notifications; regional officers see their region; `CHIEF` sees everything.
- **UI**: a dedicated `/alerts` page shows reminders for institutions and a filterable escalation queue with acknowledge/resolve actions for officers, committee members and the chief.

```bash
# Run the daily alert engine (requires CRON_SECRET to be set)
curl -X POST http://localhost:4000/cron/alerts \
  -H "Authorization: Bearer dev-cron-secret"
```

---

## 🧪 Automated Testing

The backend includes 89 unit, pipeline, scheduler and alert-engine tests running under Vitest:

```bash
cd backend
npm test
```

Test coverage includes:
1. **EVC Distance & Haversine Math**: Accurate road distance factor ($\times 1.3$) and travel duration.
2. **Conflict of Interest Filtering**: Conflicted inspectors are excluded pre-solve.
3. **Domain Matching & Distinct Pairs**: Verifies inspectors match academic domains and are distinct individuals.
4. **Demonstration Seed Case**: Verifies `INS-001` is skipped for VJTI in favor of `INS-002` and `INS-003`.
5. **Time Window & Unassigned Diagnostics**: Validates unreachable remote locations are cleanly reported as unassigned.
6. **Efficiency Baseline Comparison**: Validates positive distance savings metric.
7. **Role & Conflict API Validation**: 403 on non-officer schedule attempts, 400 on conflicted or duplicate inspector assignments.
8. **EVC Report Submission & Hash Chain**: Validates SHA-256 report hashing and state advancement to `EVC_DONE`.
9. **Expiry State Boundaries**: Exact boundary tests at 91, 90, 60, 30, 1, 0, and -1 days.
10. **Cron Idempotency**: Running `/cron/expiry-check` twice creates notifications once per tier.
11. **Application Locking & Override**: Rejection with 423 when locked; permitted with officer override remarks.
12. **Sign-Off Enforcement**: Rejection with 409 when advancing to REJECTED without CONFIRM sign-off.
13. **Document Upload & Ledger Security**: Rejection of unsupported file types and files $> 10$ MB; verifying the ledger contains SHA-256 hashes but never raw file bytes.
14. **AI Extraction Retry**: Schema validation failure triggers one retry, and fails with a clear error on persistent failure.
15. **State Machine & Ledger Integrity**: Valid transitions, terminal states, and tamper detection.

---

## 🌐 Deploying to Vercel

### Deploying the Backend API
1. Import repository in [Vercel](https://vercel.com).
2. Set **Root Directory** to `backend`.
3. Framework Preset: **Other**.
4. Build Command: `npm run build`.
5. Environment Variables:
   - `DATABASE_URL` (optional, Neon Postgres)
   - `BLOB_READ_WRITE_TOKEN` (optional, Vercel Blob)
   - `AI_GATEWAY_API_KEY` (optional, Vercel AI SDK Gateway)
   - `OPTIMIZER_URL` (optional, Python OR-Tools microservice)
   - `CRON_SECRET` (secret for `/cron/expiry-check` and `/cron/alerts`; the alert cron stays disabled without it)
   - `MAIL_MODE` (`log` | `ethereal` | `live`), `MAIL_FROM`, `PORTAL_URL`
   - `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` (only for `MAIL_MODE=live`)
   - `ALLOW_DEMO_HEADER_ROLE` (keep `false` in production)

### Deploying the Frontend
1. Import repository as a second project in Vercel.
2. Set **Root Directory** to `frontend`.
3. Framework Preset: **Next.js**.
4. Environment Variables:
   - `NEXT_PUBLIC_API_URL`: Your deployed backend URL.

---

## 🗺️ Roadmap Status

- [x] Strict state machine workflow transitions (`workflow.ts`)
- [x] SHA-256 append-only cryptographic audit ledger (`ledger.ts`)
- [x] Real multipart document upload with SHA-256 hashing (`/applications/:id/documents`)
- [x] Vercel Blob cloud storage with local `./uploads/` fallback (`storage.ts`)
- [x] Multimodal Vision AI extraction pipeline with retry & mock fallback (`extractor.ts`)
- [x] Human officer review & sign-off gate (`/applications/:id/signoff`)
- [x] Daily compliance document expiry monitor with automated lock (`/cron/expiry-check`)
- [x] In-app notifications & navbar alert bell (`NotificationBell.tsx`)
- [x] Phase A: Google OR-Tools & TypeScript VRP solver for EVC scheduling with conflict-of-interest exclusion (`optimizer/`, `scheduler.ts`)
- [x] Phase B: JWT authentication, RBAC, role isolation & SLA timelines (`services/auth.ts`, `middleware/auth.ts`)
- [x] Phase C: Config-driven reminders, escalation matrix, email delivery & `/alerts` console (`config/alerts.ts`, `services/alerts.ts`, `services/mailer.ts`)
- [ ] // TODO(next): Smart contract anchor on Polygon / Hyperledger for multi-state decentralized notary
