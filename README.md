# AICTE Approval Automation System

A full-stack, production-grade starter for automating AICTE (All India Council for Technical Education) institution approvals. It replaces manual, paperwork-heavy scrutiny with automated regulatory rule checks, strict state machine workflow progression, SLA countdown enforcement, and a tamper-evident SHA-256 cryptographic audit ledger.

---

## 🏛️ System Architecture & Workflow

```
[ Technical Institution ]            [ AICTE Scrutiny Officer ]       [ Expert Committee (EVC) ]
         │                                      │                                  │
  1. Submit Proposal                    2. Run AI Scrutiny                 3. Campus Inspection
  (Land deeds, Fire NOC)               (Land area, Lease, NOC)             (Physical verification)
         │                                      │                                  │
         ▼                                      ▼                                  ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                               Next.js 14 Web Frontend                                  │
│                 Government Portal UI (Tailwind CSS, Responsive, Role Switcher)         │
└───────────────────────────────────────────┬────────────────────────────────────────────┘
                                            │ HTTP (JSON) + x-role header
                                            ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                                 Hono API Backend                                       │
│          • State Machine (workflow.ts)      • Regulatory Rules (rules.ts)              │
│          • SHA-256 Hash Chain (ledger.ts)   • SLA Calculation (sla.ts)                 │
└───────────────────────────────────────────┬────────────────────────────────────────────┘
                                            │
                                            ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                        Tamper-Evident SHA-256 Cryptographic Chain                      │
│            hash = SHA-256(prevHash + canonicalJSON(id, app, event, actor, payload))     │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 🚀 Quickstart (Local Dev with Zero Setup)

Node.js `v18+` is required. Both backend and frontend run with built-in in-memory fallback stores and sample seed data out of the box.

### 1. Start the Backend API (Port 4000)

```bash
cd backend
npm install
npm run dev
```

The Hono API will be live at:
- Healthcheck: `http://localhost:4000/health`
- Seeded Applications: `http://localhost:4000/applications`
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

## 🧪 Running Automated Tests

The backend includes comprehensive unit tests with Vitest covering:
1. **State Machine (`src/__tests__/workflow.test.ts`)**: Valid step-by-step transitions, terminal state enforcement, and rejection of invalid jumps.
2. **Ledger Integrity (`src/__tests__/ledger.test.ts`)**: Clean chain verification, payload tampering detection, broken link detection, and genesis validation.

To run the test suite:

```bash
cd backend
npm test
```

---

## 🔍 Interactive Tamper Demonstration

This project includes a built-in cryptographic tampering simulation to demonstrate non-repudiation:

1. Open any application verification page (e.g., `http://localhost:3000/verify/APP-2024-001`).
2. Notice the green **"Ledger Verified"** badge confirming cryptographic integrity.
3. Click the **"Simulate DB Tampering"** button in the review card (or make a `POST /ledger/APP-2024-001/tamper` request).
4. The backend alters a stored payload in the database without recalculating its hash.
5. The verification engine immediately flags the discrepancy, turns the banner red with **"Tampering Detected"**, and highlights the exact block ID whose hash signature was broken!

---

## 📂 Project Structure

```
aicte-approval-system/
├── frontend/                     # Next.js (App Router), TypeScript, Tailwind CSS
│   ├── src/
│   │   ├── app/
│   │   │   ├── layout.tsx        # Portal layout with official navbar & role switcher
│   │   │   ├── page.tsx          # Landing overview & workflow pipeline strip
│   │   │   ├── institution/      # Proposals list, new application modal, detail drawer
│   │   │   ├── officer/          # Scrutiny queue, SLA indicators, Scrutiny & Advance actions
│   │   │   ├── committee/        # Read-only assigned EVC campus inspection cards
│   │   │   └── verify/[id]/      # Public ledger verification & tamper test demo
│   │   ├── components/           # Navbar, StatusBadge, SlaBadge, Timeline, DeficiencyList
│   │   └── lib/                  # Mirrored domain types, typed API client, mock fallback
│   ├── .env.example
│   └── package.json
│
├── backend/                      # Hono API on TypeScript strict
│   ├── api/index.ts              # Vercel serverless entrypoint
│   ├── src/
│   │   ├── server.ts             # Local development server (@hono/node-server)
│   │   ├── app.ts                # CORS, routing, role middleware & error handling
│   │   ├── types.ts              # Domain types (Application, Status, LedgerEntry, Deficiency)
│   │   ├── db/
│   │   │   ├── schema.ts         # Drizzle ORM schema for Neon Postgres
│   │   │   └── store.ts          # In-memory repository with zero-config seed data
│   │   ├── services/
│   │   │   ├── workflow.ts       # Strict state machine transition table & validator
│   │   │   ├── rules.ts          # AICTE clause rules (land area, lease buffer, fire NOC)
│   │   │   ├── ledger.ts         # SHA-256 hash chaining & verifyLedgerChain()
│   │   │   └── sla.ts            # SLA warning & overdue calculator
│   │   ├── routes/               # Modular Hono routers (/applications, /ledger)
│   │   └── __tests__/            # Vitest unit test suites
│   ├── vercel.json
│   ├── .env.example
│   └── package.json
│
├── docs/
│   └── ARCHITECTURE.md           # Architecture overview and diagrams
└── README.md
```

---

## 📡 Confirmed API Contract

All endpoints respond with standard JSON. Errors return `{ "error": string }`.

| Method | Endpoint | Description | Headers / Body |
| :--- | :--- | :--- | :--- |
| `GET` | `/health` | Service liveness healthcheck | None |
| `GET` | `/applications` | List applications (`?status=` / `?type=`) | None |
| `POST` | `/applications` | Create proposal (SUBMITTED status, sets SLA) | `{ institutionName, type, extracted? }` |
| `GET` | `/applications/:id` | Fetch application details | None |
| `POST` | `/applications/:id/scrutiny` | Run automated rule evaluation | Header: `x-role: officer`<br>Body: `{ landAreaSqm?, leaseEndDate?, fireNocExpiry? }` |
| `POST` | `/applications/:id/advance` | Advance workflow state | Header: `x-role: officer`<br>Body: `{ to: Status, remarks? }` |
| `GET` | `/ledger/:applicationId` | Retrieve audit chain blocks | None |
| `GET` | `/ledger/:applicationId/verify` | Cryptographically verify hash chain | None |
| `POST` | `/ledger/:applicationId/tamper` | Demonstration test helper | `{ index?: number }` |

---

## 🌐 Deployment to Vercel

Both `frontend` and `backend` are structured to deploy independently as separate projects on Vercel:

### Deploying the Backend API
1. Import the repository in [Vercel](https://vercel.com).
2. Set **Root Directory** to `backend`.
3. Framework Preset: **Other**.
4. Build Command: `npm run build`.
5. Output Directory: Leave default.
6. Environment Variables (optional):
   - `DATABASE_URL`: Connection string for Neon Postgres (if unset, automatically runs on the in-memory store).
7. Deploy. Your API will be served via `api/index.ts` with CORS preconfigured.

### Deploying the Frontend
1. Import the repository as a second project in Vercel.
2. Set **Root Directory** to `frontend`.
3. Framework Preset: **Next.js**.
4. Environment Variables:
   - `NEXT_PUBLIC_API_URL`: The deployed URL of your backend project (e.g., `https://your-backend.vercel.app`).
5. Deploy.

---

## 🔮 Roadmap & Out-of-Scope Stubs (Marked with `// TODO(next):`)
- `rules.ts`: Multimodal LLM OCR pipeline for real PDF document clause extraction.
- `committee/`: OR-Tools constraint satisfaction solver for conflict-of-interest-free EVC committee assignments.
- `ledger.ts`: Hyperledger Fabric or Polygon smart contract anchoring for decentralized multi-state notary.
