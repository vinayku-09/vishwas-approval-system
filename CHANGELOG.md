# Changelog

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
