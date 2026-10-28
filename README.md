# Vishwas: AICTE Smart Approval Workflow & Compliance Monitoring Platform

[![Live Deployment](https://img.shields.io/badge/Live%20Demo-Vercel%20Production-blue?logo=vercel)](https://vishwas-approval-system-1d9m.vercel.app/)
[![System Status](https://img.shields.io/badge/System%20Status-Verified%20%26%20Operational-2ea44f.svg)](#system-verification--quality-benchmarks)
[![Backend Tests](https://img.shields.io/badge/Backend%20Tests-253%20Passed%20%2F%20253-success.svg)](#automated-testing--verification)
[![Frontend Build](https://img.shields.io/badge/Frontend%20Build-19%20Pages%20Optimized-blue.svg)](#built-with)
[![Drizzle ORM](https://img.shields.io/badge/Database-PostgreSQL%20%2F%20Neon-336791.svg)](#database-persistence)
[![Audit Ledger](https://img.shields.io/badge/Audit%20Ledger-SHA--256%20Chained-8a2be2.svg)](#cryptographic-audit-ledger)
[![Problem Statement](https://img.shields.io/badge/SIH%202026-SH26262-orange.svg)](#problem-statement-context)

> 🚀 **Live Production Deployment:** [https://vishwas-approval-system-1d9m.vercel.app/](https://vishwas-approval-system-1d9m.vercel.app/)

**Vishwas** is a unified, secure, configurable, and automated digital platform engineered for the **All India Council for Technical Education (AICTE) - Regulation Bureau** for end-to-end processing of institutional approvals, stage-wise pendency monitoring, conflict-free Expert Visit Committee (EVC) scheduling, time-bound undertakings, lease and document validity tracking, and hierarchical automated escalation.

The platform strictly embeds **statutory regulatory safeguards**: automated engines serve as assistive decision-support tools without substituting the legal discretionary powers of competent authorities. Rejections require mandatory human sign-off, returns require recorded statutory reasons, and every state mutation is immutably sealed in an append-only cryptographic SHA-256 audit ledger.

---

## Table of Contents

- [Live Production Deployment](#live-production-deployment)
- [Problem Statement Context](#problem-statement-context)
- [System Verification & Quality Benchmarks](#system-verification--quality-benchmarks)
- [System Architecture](#system-architecture)
- [Entity-Relationship (ER) Diagram](#entity-relationship-er-diagram)
- [Project Directory Structure](#project-directory-structure)
- [Core Functional Modules](#core-functional-modules)
  - [Area A: End-to-End Approval Workflow](#area-a-end-to-end-approval-workflow)
  - [Area B: Integrated Real-Time Dashboards & Pendency](#area-b-integrated-real-time-dashboards--pendency)
  - [Area C: Conflict-Free EVC Allocation & Scheduling](#area-c-conflict-free-evc-allocation--scheduling)
  - [Area D: Time-Bound Undertakings & Compliance](#area-d-time-bound-undertakings--compliance)
  - [Area E: Continuous Lease & Document Validity Monitoring](#area-e-continuous-lease--document-validity-monitoring)
  - [Area F: Automated Notifications, Escalation & Reports](#area-f-automated-notifications-escalation--reports)
  - [Area G: Course Proposals & Normative Intake Evaluation](#area-g-course-proposals--normative-intake-evaluation)
  - [Area H: Multi-Tier Storage & Document Integrity](#area-h-multi-tier-storage--document-integrity)
- [Security, Safeguards & Cryptographic Audit Ledger](#security-safeguards--cryptographic-audit-ledger)
- [Local Setup & Quickstart](#local-setup--quickstart)
- [Seeded Demo Accounts](#seeded-demo-accounts)
- [REST API Endpoints Reference](#rest-api-endpoints-reference)
- [Production Readiness Checklist](#production-readiness-checklist)

---

## Live Production Deployment

The Vishwas platform is deployed and fully operational in production on Vercel:

- **Official Web Application URL:** [https://vishwas-approval-system-1d9m.vercel.app/](https://vishwas-approval-system-1d9m.vercel.app/)
- **Hosting Environment:** Vercel Production Environment (Next.js 14 App Router)
- **Interactive Experience:** All core portals (Institution, Scrutiny Officer, Inspection Committee, Chief / Regulation Bureau) are accessible with pre-configured one-click demo login buttons directly from the login page.

---

## Problem Statement Context

- **Organization:** All India Council for Technical Education (AICTE)
- **Department:** Regulation Bureau
- **Problem Statement Code:** SIH Problem Statement **SH26262**
- **Objective:** Develop an integrated digital platform that automates approval-related workflows across Approval Process Handbook (APH) stages (Scrutiny, Re-Scrutiny, EVC, SAC/SHC), monitors stage pendency, automates EVC allocation, tracks compliance of time-bound undertakings and validity of institutional leases/documents, and provides role-based dashboards with automated escalation to prevent regulatory lapses.

---

## System Verification & Quality Benchmarks

The Vishwas platform meets and exceeds all regulatory and engineering specifications under problem statement **SH26262**:

| Evaluation Dimension | Benchmark Metric | Result | Operational Guarantee |
| :--- | :--- | :---: | :--- |
| **Backend Test Suite** | **253 / 253 passed** in 17 test suites | **PASS** | 100% test coverage across workflows, alert cron, and scoping. |
| **Type Integrity** | `tsc --noEmit` strict mode | **PASS** | Zero type errors, strict domain schemas, no dynamic bypasses. |
| **Frontend Production Build** | Next.js 14.2 App Router (19/19 routes) | **PASS** | Fully compiled, statically optimized, 0 build warnings. |
| **Database Migrations** | 18 PostgreSQL tables (Drizzle ORM) | **PASS** | Zero-downtime schema evolution and indexed foreign keys. |
| **Cron Idempotency** | Double execution test | **PASS** | Exactly-once alert delivery; 0 duplicate alerts generated. |
| **Cryptographic Integrity** | SHA-256 Ledger chain verification | **PASS** | Full mathematical chain validation; tamper-evident proof. |
| **File Storage Security** | PDF magic-bytes (`%PDF-`) & SHA-256 | **PASS** | 10MB ceiling, server-side re-verification on read, draft guard. |


---

## System Architecture

The Vishwas platform uses a modern decoupled architecture:
1. **Frontend Client Layer:** Next.js 14 App Router, React Server/Client Components, TailwindCSS/Vanilla CSS styling, Role-Scoped Views, and Accessibility compliance.
2. **API & Workflow Layer:** High-throughput TypeScript API powered by Hono, enforcing strict route state machines, JWT authentication, and RBAC / Regional jurisdictional scoping.
3. **Core Evaluation Engines:** Pure functional rule evaluation for normative intake ratios, multi-tier SLA countdowns, expiry monitors, and conflict-of-interest filters.
4. **Data Persistence & Ledger:** PostgreSQL (via Neon / Docker) with Drizzle ORM, accompanied by an in-memory repository for zero-dependency standalone execution and an append-only SHA-256 chained audit ledger.
5. **Storage & Optimization Layer:** Multi-mode document storage (Local, PostgreSQL JSONB, Vercel Blob private-access) with PDF magic-byte checks (`%PDF-`) and Python Google OR-Tools CP-SAT optimizer with high-performance in-memory fallback.

```mermaid
graph TB
    subgraph Users ["User Personas & Portals"]
        INST["🎓 Technical Institution<br/>(Profile, Intake, Evidence)"]
        RO["🏛️ Regional Officer (RO)<br/>(Scrutiny, Returns, Verification)"]
        COMM["📋 Committee Member<br/>(EVC Geotagged Inspections)"]
        CHIEF["⚖️ Regulation Bureau / Chief<br/>(Governance, SLA, National Overview)"]
    end

    subgraph Frontend ["Next.js 14 App Router (Port 3000)"]
        UI_AUTH["Auth & OTP Login<br/>(/login, /register, /verify-email)"]
        UI_DASH["Real-Time Dashboards<br/>(/dashboard, /analytics, /evc-board)"]
        UI_CASE["Electronic Case Summary<br/>(/case/[id] - Read-Only View)"]
        UI_QUEUE["Officer Verification Queues<br/>(/officer, /institution/proposals)"]
        UI_AUDIT["Audit & Reports<br/>(/audit, /reports, /configuration)"]
    end

    subgraph Backend ["Hono API Server (Port 4000)"]
        MW_AUTH["JWT Authentication & RBAC<br/>(Role & Regional Scoping)"]
        SM_WF["Approval State Machine<br/>(Only Scrutiny, Scrutiny+EVC, Appeal)"]
        
        subgraph Engines ["Assistive Intelligent Engines"]
            ENG_RULE["Normative Check Engine<br/>(Cadre, Area, Pay, NOCs)"]
            ENG_EXP["Document Expiry Monitor<br/>(90d / 60d / 30d Warning & Freeze)"]
            ENG_SLA["SLA & Pendency Tracker<br/>(Bottlenecks, Ageing, Countdown)"]
            ENG_ESC["Hierarchical Escalation<br/>(L1 Regional -> L2 Bureau -> L3 Chief)"]
            ENG_COI["EVC Allocation Engine<br/>(CP-SAT Solver + In-Memory Fallback)"]
        end
    end

    subgraph StorageSecurity ["Storage, Database & Cryptography"]
        PG[("PostgreSQL / Neon DB<br/>(18 Drizzle Tables)")]
        LEDGER[("Append-Only SHA-256 Ledger<br/>hash = SHA256(prevHash + block)")]
        BLOB[("Multi-Mode File Storage<br/>(Local / Postgres / Vercel Blob)")]
        AES["AES-256-GCM Vault<br/>(Bank Details Encryption)"]
    end

    subgraph External ["External Services"]
        OPT["Python OR-Tools Optimizer<br/>(FastAPI Service)"]
        SMTP["Transactional Mailer<br/>(Ethereal / Nodemailer / SMTP)"]
    end

    INST & RO & COMM & CHIEF --> UI_AUTH
    UI_AUTH & UI_DASH & UI_CASE & UI_QUEUE & UI_AUDIT -->|HTTPS / REST API| MW_AUTH
    MW_AUTH --> SM_WF
    SM_WF --> Engines
    ENG_RULE & ENG_EXP & ENG_SLA & ENG_ESC --> PG
    ENG_COI -.->|Optimal CSP| OPT
    ENG_ESC --> SMTP
    Backend --> BLOB
    Backend --> AES
    SM_WF & ENG_ESC & ENG_EXP -->|Cryptographic Hash Link| LEDGER
```

---

## Entity-Relationship (ER) Diagram

The system database schema encompasses 18 relational tables managed via Drizzle ORM, maintaining domain separation, indexing on foreign keys and jurisdictional scopes, and enforcing idempotent transactional constraints.

```mermaid
erDiagram
    USERS {
        text id PK
        text email UK
        text role
        text region
        jsonb data
    }

    APPLICATIONS {
        text id PK
        text status
        text type
        text created_at
        jsonb data
    }

    STORED_FILES {
        text id PK
        text pathname
        text sha256
        integer size
        text content_type
        text institution_id
        text region
        integer is_draft
        text uploaded_at
        jsonb data
    }

    DOCUMENTS {
        text id PK
        text application_id FK
        jsonb data
    }

    COMPLIANCE_DOCUMENTS {
        text id PK
        text application_id FK
        jsonb data
    }

    UNDERTAKINGS {
        text id PK
        text application_id FK
        text status
        text due_date
        jsonb data
    }

    EVIDENCE {
        text id PK
        text undertaking_id FK
        jsonb data
    }

    VERIFICATIONS {
        text id PK
        text undertaking_id FK
        jsonb data
    }

    COURSE_PROPOSALS {
        text id PK
        text institution_id
        text application_id FK
        text type
        text status
        jsonb data
    }

    PROPOSED_BRANCHES {
        text id PK
        text proposal_id FK
        jsonb data
    }

    INSPECTIONS {
        text id PK
        text application_id FK
        jsonb data
    }

    INSPECTORS {
        text id PK
        text domain
        jsonb data
    }

    AFFILIATIONS {
        text id PK
        text inspector_id FK
        jsonb data
    }

    SIGNOFFS {
        text application_id PK
        jsonb data
    }

    LEDGER {
        text id PK
        text application_id FK
        integer chain_index
        jsonb data
    }

    NOTIFICATIONS {
        text id PK
        text application_id FK
        text idempotency_key UK
        text recipient_role
        text region
        text institution_name
        jsonb data
    }

    ALERT_LOGS {
        text id PK
        text idempotency_key UK
        text application_id FK
        text created_at
        jsonb data
    }

    ESCALATIONS {
        text id PK
        text application_id FK
        text event_type
        text status
        text region
        text created_at
        jsonb data
    }

    APPLICATIONS ||--o{ DOCUMENTS : "attaches"
    APPLICATIONS ||--o{ COMPLIANCE_DOCUMENTS : "monitors"
    APPLICATIONS ||--o{ UNDERTAKINGS : "imposes"
    APPLICATIONS ||--o{ COURSE_PROPOSALS : "contains"
    APPLICATIONS ||--o{ INSPECTIONS : "undergoes"
    APPLICATIONS ||--o| SIGNOFFS : "confirmed_by"
    APPLICATIONS ||--o{ LEDGER : "records"
    APPLICATIONS ||--o{ NOTIFICATIONS : "triggers"
    APPLICATIONS ||--o{ ALERT_LOGS : "logs"
    APPLICATIONS ||--o{ ESCALATIONS : "escalates"

    UNDERTAKINGS ||--o{ EVIDENCE : "fulfilled_with"
    UNDERTAKINGS ||--o{ VERIFICATIONS : "audited_by"

    COURSE_PROPOSALS ||--o{ PROPOSED_BRANCHES : "specifies"

    INSPECTORS ||--o{ AFFILIATIONS : "declares_coi"
    INSPECTIONS }o--o{ INSPECTORS : "conducted_by"
```

---

## Project Directory Structure

```text
aicte-approval-system/
├── backend/                             # High-performance Hono API server
│   ├── drizzle/                         # Auto-generated SQL schema migrations
│   │   ├── 0000_initial.sql             # Base schema (applications, users, documents, ledger)
│   │   ├── 0001_undertakings_renewals.sql # Undertakings, evidence, verifications
│   │   └── 0002_course_proposals.sql    # Course proposals, branches, stored files
│   ├── src/
│   │   ├── __tests__/                   # Comprehensive automated test suite (17 test files)
│   │   │   ├── alerts.test.ts           # 3-tier escalation engine tests
│   │   │   ├── auth.test.ts             # JWT, role enforcement, OTP registration tests
│   │   │   ├── course_proposals.test.ts # 7 statutory check rules, ledger integrity tests
│   │   │   ├── evc_optimizer.test.ts    # COI matrix, specialization balance tests
│   │   │   ├── file_storage.test.ts     # Magic bytes, SHA-256 verify, Blob mock tests
│   │   │   ├── reports_part6.test.ts    # 6 MIS reports, RFC 4180 CSV export tests
│   │   │   └── undertakings.test.ts     # Cure periods, verification queue tests
│   │   ├── config/                      # Configurable rules aligned with APH
│   │   │   ├── alerts.ts                # Escalation matrix and reminder offsets
│   │   │   ├── courseNorms.ts           # AICTE normative ratios (UG 1:20, PG 1:15)
│   │   │   ├── routes.ts                # Canonical route definitions & return targets
│   │   │   ├── sla-config.ts            # Stage-level SLA durations & ageing buckets
│   │   │   └── timelines.ts             # Warning tiers (90/60/30 days) & parameters
│   │   ├── db/                          # Database abstractions and seeds
│   │   │   ├── schema.ts                # Drizzle ORM PostgreSQL schema
│   │   │   ├── store.ts                 # Dual store (PostgresStore & InMemoryStore)
│   │   │   ├── seed.ts                  # Idempotent deterministic seed
│   │   │   └── demoSeedPart6.ts         # Insert-only seed (42 comprehensive applications)
│   │   ├── middleware/                  # Request lifecycle interceptors
│   │   │   ├── access.ts                # Role and regional jurisdiction boundary guards
│   │   │   └── auth.ts                  # JWT token verification & claim extraction
│   │   ├── routes/                      # REST API routing endpoints
│   │   │   ├── applications.ts          # State machine advancement & sign-offs
│   │   │   ├── auth.ts                  # Login, registration, email verification
│   │   │   ├── cron.ts                  # Idempotent alerts & expiry monitoring triggers
│   │   │   ├── dashboards.ts            # Stage pendency and EVC board feeds
│   │   │   ├── files.ts                 # Secure authenticated & scoped file streaming
│   │   │   ├── proposals.ts             # Course and intake branch proposals
│   │   │   ├── reports.ts               # Executive MIS reports with CSV generation
│   │   │   └── undertakings.ts          # Undertakings lifecycle & evidence submission
│   │   ├── services/                    # Core business logic & pure engines
│   │   │   ├── branchCheck.ts           # Pure 7-dimension normative rule evaluator
│   │   │   ├── evcOptimizer.ts          # Conflict-free committee allocation solver
│   │   │   ├── expiryMonitor.ts         # Document validity & application freeze logic
│   │   │   ├── ledger.ts                # SHA-256 block ledger creation & verification
│   │   │   ├── mailer.ts                # Multi-mode email dispatcher (log, Ethereal, SMTP)
│   │   │   └── pendency.ts              # Stage SLA countdown & bottleneck calculations
│   │   ├── storage/                     # Multi-mode file storage layer
│   │   │   ├── fileStorage.ts           # Storage interface, magic-byte check, SHA-256
│   │   │   ├── localFileStorage.ts      # Local disk storage implementation
│   │   │   ├── postgresFileStorage.ts   # Database JSONB base64 implementation
│   │   │   └── blobStorage.ts           # Vercel Blob private-access implementation
│   │   └── app.ts                       # Hono application bootstrap & CORS wiring
│   ├── package.json
│   └── tsconfig.json
├── frontend/                            # Next.js 14 App Router portal
│   ├── src/
│   │   ├── app/                         # App Router page routes (19 compiled routes)
│   │   │   ├── alerts/                  # In-app notifications & multi-tier escalations
│   │   │   ├── analytics/               # System throughput & stage processing trends
│   │   │   ├── audit/                   # Queryable ledger explorer with block inspector
│   │   │   ├── case/[id]/               # Read-only electronic case summary
│   │   │   ├── committee/               # EVC inspector assignments & report submissions
│   │   │   ├── configuration/           # Governance view with APH placeholder notices
│   │   │   ├── dashboard/               # Consolidated pendency & bottleneck dashboard
│   │   │   ├── evc-board/               # Dedicated EVC queue (awaiting, scheduled, delayed)
│   │   │   ├── institution/             # Institution dashboard, profile & compliance
│   │   │   │   ├── profile/             # Profile builder (Trust, Land, Bank encryption)
│   │   │   │   └── proposals/           # Course proposal builder & normative checks
│   │   │   ├── officer/                 # Officer scrutiny queue, verification queue
│   │   │   ├── register/                # Technical institution registration with OTP
│   │   │   ├── reports/                 # 6 MIS reports with dynamic RFC 4180 CSV export
│   │   │   ├── verify/[id]/             # Public cryptographic ledger verification
│   │   │   └── page.tsx                 # Public landing page with statutory overview
│   │   ├── components/                  # Reusable UI component library
│   │   │   ├── Navbar.tsx               # Role-aware responsive navigation bar
│   │   │   ├── SafeguardNotice.tsx      # Universal human-in-the-loop statutory notice
│   │   │   └── NotificationBell.tsx     # Real-time alert badge & dropdown
│   │   └── lib/                         # Client utilities, API fetcher & session handling
│   ├── package.json
│   └── tsconfig.json
├── optimizer/                           # Mathematical optimization engine
│   └── api/
│       └── optimize.py                  # Google OR-Tools CP-SAT vehicle-routing solver
├── CHANGELOG.md                         # Chronological evolution of the platform
└── README.md                            # Executive documentation & operational guide
```

---

## Core Functional Modules

### Area A: End-to-End Approval Workflow
- **Four Canonical Approval Routes:**
  - `ONLY_SCRUTINY`: Selected for *Extension of Approval (EoA)* (`SUBMITTED -> SCRUTINY -> DECISION`).
  - `SCRUTINY_EVC`: Selected for *New Institution Setup* (`SUBMITTED -> SCRUTINY -> EVC_REQUIRED -> EVC_DONE -> DECISION`).
  - `EVC_SAC_SHC`: Selected for *Appeals / Re-Scrutiny* (`SUBMITTED -> SCRUTINY -> EVC_REQUIRED -> EVC_DONE -> DECISION -> APPEAL_SHC -> APPEAL_SAC`).
  - `ONLY_EVC`: Selected for *Intake Change / Infrastructure Alteration* (`SUBMITTED -> EVC_REQUIRED -> EVC_DONE -> DECISION`).
- **Guarded Stage Advancement:** Strict transition state machine rejects out-of-order stages. Automated stage advance is enabled for preliminary stages; final decisions require human confirmation.
- **Categorized Return / Revert:** Allows officers to return applications for clarification across 5 standardized categories (`INCOMPLETE_DOCUMENT`, `DATA_MISMATCH`, `FEE_DEFICIENCY`, `FORMAT_ERROR`, `OTHER`) with mandatory written reasons. Includes institutional reply tracking.
- **Electronic Case Summary (`/case/[id]`):** Assembles application metadata, stage history, return records, scrutiny sign-offs, inspection results, compliance documents, and cryptographic hash verification into a single consolidated, read-only dossier.

### Area B: Integrated Real-Time Dashboards & Pendency
- **Multi-Level Dashboard:** Displays real-time application distribution across regions (`NORTH`, `SOUTH`, `EAST`, `WEST`, `CENTRAL`, `NORTH_EAST`), processing stages, and responsible committees.
- **Ageing & Bottleneck Monitoring:** Tracks processing age in days against stage SLAs, categorizing applications into dynamic ageing buckets (`0-7d`, `8-15d`, `16-30d`, `>30d`).
- **Visual Status Badging:** Clear indicators for applications marked `On Time`, `Approaching SLA` (≤ 3 days left), or `Overdue`.
- **Role-Based Jurisdictional Scoping:** Regional officers only view files in their geographic domain; AICTE Head Office and Chief have national oversight; institutions strictly view their own applications.

### Area C: Conflict-Free EVC Allocation & Scheduling
- **Automated Queueing:** Applications reaching `EVC_REQUIRED` are queued automatically for committee constitution.
- **Bi-Directional Conflict of Interest (COI) Matrix:** Inspectors are programmatically filtered against institutions to eliminate COI:
  - Same state exclusion.
  - Previous or current employment history.
  - Alma mater / graduation ties.
  - Declared familial or advisory affiliations.
- **Committee Composition Norms:** Enforces 3-member panels consisting of 1 Senior Academician, 1 Domain Specialist, and 1 Council/Industry Observer, respecting inspector workload limits.
- **High-Performance Fallback:** Includes a Python Google OR-Tools CP-SAT solver and a deterministic TypeScript fallback ensuring zero downtime even if the external optimizer is offline.
- **Geotagged Inspection Reports:** Validates GPS coordinates within ±200m of the registered campus boundary with EXIF photo checks.

### Area D: Time-Bound Undertakings & Compliance
- **Digital Conditional Undertakings:** Approvals granted subject to conditions (e.g., deficiency cure periods) generate structured digital undertakings.
- **Statutory Cure Periods:** Configurable cure durations (15 to 90 days) based on deficiency nature (Land, Faculty cadre, Corpus fund, Laboratory equipment).
- **Online Evidence Submission:** Institutions submit digital evidence with notarized references, photos, and SHA-256 file fingerprints.
- **Officer Verification Queue (`/officer`):** Scoped queue allowing regional officers to inspect evidence and record `VERIFIED` or `REJECTED`. Rejections require mandatory written remarks and an existing confirmed sign-off.
- **Automated Overdue Enforcement:** Daily cron automatically flags unfulfilled undertakings past due dates as `OVERDUE` and triggers immediate escalation.

### Area E: Continuous Lease & Document Validity Monitoring
- **Document Expiry Engine:** Monitors validity dates of critical documents: Fire Safety NOC, Land Lease Deed, Building Safety Certificate, and University Affiliation NOC.
- **Proactive Warning Tiers:** Automatically triggers notifications and badges at **90-day**, **60-day**, and **30-day** milestones before document expiration.
- **System-Enforced Application Lock:** Applications with expired statutory documents (`daysRemaining <= 0`) are frozen (`locked: true`), blocking further progression until valid renewals are verified.
- **Renewal Verification & Auto-Unlock:** Verification of renewed documents by regional officers extends the statutory validity date in the database and automatically releases application locks.

### Area F: Automated Notifications, Escalation & Reports
- **Multi-Tier Escalation Matrix:**
  - **Level 1 (Regional Officer):** Dispatched at +1 day delay past prescribed timeline.
  - **Level 2 (Bureau Head):** Escalated at +3 days delay.
  - **Level 3 (Member Secretary / AICTE Chief):** Escalated at +7 days delay.
- **Multi-Channel Dispatch:** In-app notification center, persistent alert logs, and template-based emails (supporting Ethereal test previews and live SMTP).
- **Six Comprehensive MIS Reports:**
  1. *Application Pendency Report* (stage-wise processing age and bottlenecks).
  2. *EVC Status Report* (scheduled, completed, and delayed inspection visits).
  3. *Undertaking Compliance Report* (status of conditions and cure periods).
  4. *Document Validity & Renewals Report* (warning tiers and expired documents).
  5. *Overdue Cases & Escalations Report* (active Level 1, 2, and 3 escalations).
  6. *Region-Wise Performance Analytics* (average turnaround time, return rates).
- **RFC 4180 CSV Export:** Direct client-side streaming supporting `?format=csv` and `Accept: text/csv` headers with role/region scoping.

### Area G: Course Proposals & Normative Intake Evaluation
- **Course Proposal Builder (`/institution/proposals`):** Supports application types for *New Institution*, *Extension of Approval*, *New Course Addition*, *Intake Increase*, and *Course Closure*.
- **7-Dimension Normative Engine (`branchCheck.ts`):** Evaluates branch proposals against statutory AICTE guidelines:
  1. *Faculty Cadre Ratio* (UG 1:20, PG 1:15, Diploma 1:25).
  2. *Faculty Pay Compliance* (Sixth/Seventh CPC scales, cadre vacancy ceilings).
  3. *Campus Land Sufficiency* (computes required land area against institutional profile land).
  4. *Laboratory Infrastructure* (minimum 4 labs per branch, instructional built-up area).
  5. *Affiliating University NOC* (verifies state board / university clearance).
  6. *Intake Increments & Ceilings* (standard 30/60 division steps; +60 seat single-year ceiling).
  7. *Document Validity* (checks that supporting certificates are active).
- **Assistive Safeguard Guarantee:** Automated checks serve as assistive indicators and **never auto-reject or block** proposal submissions. Formal determinations require officer appraisal with mandatory remarks.

### Area H: Multi-Tier Storage & Document Integrity
- **Configurable Storage Modes (`STORAGE_MODE=local|postgres|blob`):**
  - *Local:* Writes files to local directory; re-verifies SHA-256 on read.
  - *PostgreSQL:* Stores base64-encoded files in JSONB payload for self-contained testing.
  - *Vercel Blob:* Production mode using `access: 'private'`, random suffixes, and private streaming.
- **Upload Integrity Controls:** Enforces PDF magic-byte (`%PDF-`) verification, 10 MB file size limit, pre-upload SHA-256 calculation, and re-verification on read (returns HTTP 409 Conflict on checksum mismatch).
- **Draft-Only Deletion Safeguard:** Once evidence or an application is submitted (`isDraft = false`), file deletion is blocked at the database and storage layers.

---

## Security, Safeguards & Cryptographic Audit Ledger

### 1. Human-in-the-Loop Regulatory Safeguard
The platform operates under the core design principle that automated algorithms, OCR extraction, and normative engines are **assistive decision aids, never substituting the statutory discretion of competent authorities**:
- Rejection of an application requires confirmed sign-off by an authorized officer with written statutory grounds.
- Automated document risk indicators are labeled `"risk indicators, not proof"`.
- A universal `SafeguardNotice` component is displayed across officer review screens, EVC inspection reporting, and case summaries.

### 2. Append-Only Cryptographic SHA-256 Audit Ledger
Every state change, document upload, return notice, verification, rejection, alert dispatch, and escalation writes an immutable block to the audit ledger:
$$\text{Block Hash} = \text{SHA-256}(\text{previousHash} + \text{id} + \text{applicationId} + \text{timestamp} + \text{eventType} + \text{actor} + \text{payload})$$
- The ledger guarantees complete forward integrity: tampering with any past record breaks the entire subsequent cryptographic chain.
- The public ledger explorer (`/verify/[id]`) and head-office audit view (`/audit`) run live mathematical chain verifications using `verifyLedgerChain`.
- Ledger payloads store entity IDs and cryptographic SHA-256 hashes only, ensuring no unhashed PII is exposed.

### 3. Data Confidentiality & Encryption
- **Bank Credentials Vault:** Institutional bank account numbers, IFSC codes, and security deposit FDR details are encrypted at rest using **AES-256-GCM** (`BANK_ENCRYPTION_KEY`). All UI views mask account numbers (`••••••••1234`).
- **Access Boundary Enforcement:** Role-based access control (RBAC) and regional scoping prevent unauthorized horizontal or vertical data traversal.

---

## Local Setup & Quickstart

### Prerequisites
- **Node.js:** v18.0.0 or newer
- **npm:** v9.0.0 or newer
- **PostgreSQL / Neon (Optional for local testing):** If `DATABASE_URL` is omitted, the backend defaults to the built-in `InMemoryStore` for immediate out-of-the-box operation.

### 1. Clone & Install Dependencies

```bash
# Clone the repository
git clone https://github.com/your-org/aicte-approval-system.git
cd aicte-approval-system

# Install backend dependencies
cd backend
npm install

# Install frontend dependencies
cd ../frontend
npm install
```

### 2. Environment Configuration

Copy the example environment files:

```bash
# In backend/
cp .env.example .env

# In frontend/
cp .env.example .env.local
```

Key environment variables in `backend/.env`:
```ini
PORT=4000
NODE_ENV=development
JWT_SECRET=super-secret-jwt-key-min-32-chars
CRON_SECRET=super-secret-cron-token
STORAGE_MODE=local
UPLOAD_DIR=./uploads
MAIL_MODE=log
PORTAL_URL=http://localhost:3000
# DATABASE_URL=postgresql://user:pass@localhost:5432/aicte_db (Optional)
```

### 3. Run Migrations & Seed (PostgreSQL Mode)

If using PostgreSQL / Neon:
```bash
cd backend
npm run db:migrate
npm run db:seed
```

### 4. Start Development Servers

Run backend and frontend in separate terminal windows:

```bash
# Terminal 1: Backend API (Port 4000)
cd backend
npm run dev

# Terminal 2: Frontend Client (Port 3000)
cd frontend
npm run dev
```

Open your browser at **`http://localhost:3000`**.

---

## Automated Testing & Verification

The repository contains an automated test suite verifying all statutory workflows, cryptographic hashing, and security scoping:

```bash
# Run backend test suite
cd backend
npm test

# Run strict TypeScript verification
npm run build

# Run frontend production build
cd ../frontend
npm run build
```

**Verification Results:**
- **Backend Tests:** `17 test files passed (17)`, `253 tests passed (253)`.
- **Frontend Pages:** `19 / 19 routes` compiled with 0 errors.

---

## Seeded Demo Accounts

The database seed populates pre-configured test accounts across all statutory roles. Use the one-click demo login buttons on the `/login` screen:

| Email | Role | Region Scope | Responsibilities |
| :--- | :--- | :--- | :--- |
| `chief@aicte.gov.in` | `CHIEF` | National (ALL) | Regulation Bureau Head, executive dashboards, national audit ledger, Level 3 escalations. |
| `officer.west@aicte.gov.in` | `OFFICER` | `WEST` | Western Regional Office scrutiny, deficiency returns, compliance verification queue. |
| `officer@aicte.gov.in` | `OFFICER` | National (ALL) | Central scrutiny officer, application review, stage advancement. |
| `committee@aicte.gov.in` | `COMMITTEE` | `WEST` | Expert Visit Committee inspector, geotagged report submission. |
| `delhi.tech@aicte.gov.in` | `INSTITUTION` | `NORTH` | Technical institution: application submission, course proposals, compliance uploads. |
| `kaveri.poly@aicte.gov.in` | `INSTITUTION` | `SOUTH` | Polytechnic institute: renewal submissions, undertaking evidence attachments. |
| `vjti@mumbai.edu` | `INSTITUTION` | `WEST` | Engineering college: EoA application, course addition, profile management. |

*Default Demo Password for all seeded accounts:* `demo1234` *(shown on login interface)*.

---

## REST API Endpoints Reference

| Method | Endpoint | Access Role | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/auth/login` | Public | Authenticates credentials and returns signed 8-hour JWT. |
| `POST` | `/auth/register` | Public | Technical college registration with 6-digit OTP verification. |
| `GET` | `/applications` | Authenticated | Lists applications scoped by caller's role and region. |
| `GET` | `/applications/:id` | Authenticated | Retrieves comprehensive application details and routing metadata. |
| `POST` | `/applications/:id/advance` | Officer / Chief | Advances application to the next prescribed stage. |
| `POST` | `/applications/:id/return` | Officer / Chief | Reverts application for deficiencies with mandatory category & reason. |
| `GET` | `/applications/:id/case-summary`| Authenticated | Generates consolidated read-only electronic case summary. |
| `GET` | `/dashboards/pendency` | Officer / Chief | Retrieves stage pendency metrics, ageing buckets, and bottlenecks. |
| `GET` | `/dashboards/evc-board` | Officer / Committee | Feeds the EVC scheduling board (awaiting, scheduled, delayed). |
| `POST` | `/undertakings/:id/evidence` | Institution | Uploads compliance evidence against time-bound undertaking. |
| `POST` | `/undertakings/:id/verify` | Officer / Chief | Verifies or rejects undertaking evidence with statutory remarks. |
| `GET` | `/reports/:type` | Officer / Chief | Generates any of the 6 MIS reports (supports `format=csv`). |
| `GET` | `/ledger/:id/verify` | Public | Cryptographically verifies the SHA-256 hash chain for an application. |
| `POST` | `/cron/alerts` | Cron Secret | Executes daily reminder and multi-tier escalation job (idempotent). |
| `POST` | `/cron/expiry-check` | Cron Secret | Runs daily document validity check and enforces application locks. |

---

## Production Readiness Checklist

- [x] **Strict Type Checking:** Zero TypeScript warnings or `any` escape hatches in domain logic.
- [x] **Zero Plaintext PII in Ledger:** All ledger payload events store entity IDs and SHA-256 hashes only.
- [x] **Cryptographic Hash Re-Verification:** Served files are checked against stored hashes before streaming; returns HTTP 409 Conflict if tampered.
- [x] **Idempotency Guarantees:** Alert logs and notifications enforce unique database keys, eliminating duplicate alerts across redundant cron invocations.
- [x] **Insert-Only Demo Seeds:** Database seeding logic filters existing primary keys to avoid overwriting operational records.
- [x] **Statutory Disclosure Notice:** All placeholder thresholds (stage SLA days, 90/60/30-day warning tiers, 1:20 ratios) are centralized in configuration files and clearly designated as `"placeholder pending APH"`.
- [x] **Security Audited:** Private file serving, no public blob URLs, AES-256-GCM bank encryption, bcrypt password hashing, and role/region scoping across all endpoints.

---

## License & Attribution

Developed for the **Smart India Hackathon 2026** under Problem Statement **SH26262** for the **All India Council for Technical Education (AICTE), Ministry of Education, Government of India**.
