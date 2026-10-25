# Vishwas Approval System

A full-stack, production-grade automation system for AICTE (All India Council for Technical Education) technical institution approvals. **Vishwas** replaces paper-heavy regulatory bureaucracy with verified document uploads, multimodal AI document extraction, deterministic rules scrutiny, human officer sign-off gates, daily compliance expiry monitoring with automated locking, and an append-only SHA-256 cryptographic audit ledger.

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
| `CRON_SECRET` | Bearer token protecting `/cron/expiry-check` | Accepts `Bearer dev-cron-secret` for local development & testing |
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
| `POST` | `/cron/expiry-check` | Daily job to recompute expiry tiers (90/60/30) & lock overdue apps | Header: `Authorization: Bearer <CRON_SECRET>` |
| `GET` | `/notifications` | List compliance notifications (newest first) | None |
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

## 🧪 Automated Testing

The backend includes 33 unit and pipeline tests running under Vitest:

```bash
cd backend
npm test
```

Test coverage includes:
1. **Expiry State Boundaries**: Exact boundary tests at 91, 90, 60, 30, 1, 0, and -1 days.
2. **Cron Idempotency**: Running `/cron/expiry-check` twice creates notifications once per tier.
3. **Application Locking & Override**: Rejection with 423 when locked; permitted with officer override remarks.
4. **Sign-Off Enforcement**: Rejection with 409 when advancing to REJECTED without CONFIRM sign-off.
5. **Document Upload & Ledger Security**: Rejection of unsupported file types and files $> 10$ MB; verifying the ledger contains SHA-256 hashes but never raw file bytes.
6. **AI Extraction Retry**: Schema validation failure triggers one retry, and fails with a clear error on persistent failure.
7. **State Machine & Ledger Integrity**: Valid transitions, terminal states, and tamper detection.

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
   - `CRON_SECRET` (secret for `/cron/expiry-check`)

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
- [ ] // TODO(next): OR-Tools constraint solver for Expert Visit Committee (EVC) conflict-of-interest scheduling
- [ ] // TODO(next): Smart contract anchor on Polygon / Hyperledger for multi-state decentralized notary
