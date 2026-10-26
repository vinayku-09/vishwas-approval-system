# Assumptions and Placeholders

> **Placeholder pending the Approval Process Handbook (APH); not an official AICTE rule.** All values below are product assumptions for the SIH 2026 SH26262 prototype. They must be reviewed and replaced with approved policy values before any production use.

## Current Placeholder Values

| Area | Placeholder value | Config location | PS area served |
| :--- | :--- | :--- | :--- |
| Application SLA, new | 21 calendar days | `backend/src/config/timelines.ts` (`SLA_WINDOW_DAYS_NEW`) | B - pendency |
| Application SLA, extension | 21 calendar days | `backend/src/config/timelines.ts` (`SLA_WINDOW_DAYS_EXTENSION`) | B - pendency |
| Application SLA, intake change | 21 calendar days | `backend/src/config/timelines.ts` (`SLA_WINDOW_DAYS_INTAKE_CHANGE`) | B - pendency |
| SLA warning threshold | 80% of window elapsed | `backend/src/config/timelines.ts` (`SLA_WARNING_THRESHOLD`) | B - pendency |
| Expiry warning tiers | 90, 60 and 30 days | `backend/src/config/timelines.ts` (`EXPIRY_TIER_HIGH`, `EXPIRY_TIER_MEDIUM`, `EXPIRY_TIER_LOW`) | D/E - compliance and renewal |
| Minimum land area rule | 6,000 sq m | `backend/src/config/timelines.ts` (`RULE_MIN_LAND_AREA_SQM`) | A/C - scrutiny and EVC |
| Lease validity buffer | 90 days | `backend/src/config/timelines.ts` (`RULE_LEASE_BUFFER_DAYS`) | A/C - scrutiny and EVC |
| Alert reminder offsets | 30, 15, 7 and 1 days before due date | `backend/src/config/alerts.ts` (`ALERT_REMINDER_OFFSETS_DAYS`) | B/C - pendency and visibility |
| Pendency escalation delays | 1, 3 and 7 days after due date | `backend/src/config/alerts.ts` (`ESCALATION_MATRIX`) | B - pendency |
| EVC scheduling escalation delays | 1 and 3 days after due date | `backend/src/config/alerts.ts` (`ESCALATION_MATRIX`) | C - EVC visibility |
| EVC report escalation delays | 2 and 5 days after due date | `backend/src/config/alerts.ts` (`ESCALATION_MATRIX`) | C - EVC visibility |
| Undertaking escalation delays | 1, 3 and 7 days after due date | `backend/src/config/alerts.ts` (`ESCALATION_MATRIX`) | D - undertakings |
| Document expiry escalation delays | 0, 2 and 5 days after due date | `backend/src/config/alerts.ts` (`ESCALATION_MATRIX`) | D/E - compliance and renewal |
| Document authenticity escalation delays | 1 and 3 days after due date | `backend/src/config/alerts.ts` (`ESCALATION_MATRIX`) | C - visibility placeholder |
| Inspection duration | 4 hours | `backend/src/config/timelines.ts` (`INSPECTION_DURATION_HOURS`) | C - EVC |
| Inspection working window | 09:00 to 18:00 | `backend/src/config/timelines.ts` (`INSPECTION_START_HOUR`, `INSPECTION_END_HOUR`) | C - EVC |
| Assumed road speed | 40 km/h | `backend/src/config/timelines.ts` (`TRAVEL_SPEED_KMH`) | C - EVC |
| Road winding factor | 1.3 x haversine distance | `backend/src/config/timelines.ts` (`ROAD_WINDING_FACTOR`) | C - EVC |
| EVC team size | 2 distinct inspectors | `backend/src/services/scheduler.ts` | C - EVC |

## Not Yet Implemented

| Concern | Planned location | Status |
| :--- | :--- | :--- |
| Four approval routes and application-type mapping | `backend/src/config/routes.ts` (planned Part 2) | Not built |
| Stage order and automatic progression | Part 2 routing service | Not built |
| Stage SLA days and approaching threshold | Part 3 stage-SLA config | Not built |
| Ageing bucket boundaries (for example 0-7, 8-15, 16-30, 30+) | Part 3 dashboard config | Not built |
| Undertaking due-date rules | Part 4 config/model | Not built |
| Renewal validity periods | Part 4 config/model | Not built |

## Other Assumptions

- Demo institutions, applications, documents, inspections, users and alerts are simulated and contain no real personal data.
- AI extraction is a deterministic mock unless `AI_GATEWAY_API_KEY` is configured.
- The Python OR-Tools optimizer is unverified in this environment; the tested scheduler is the TypeScript fallback.
- Email delivery was verified with Ethereal only. Live SMTP is unverified.
- The current seeded data is intentionally reset by `db:seed`; do not run the seed against a database containing records that must be preserved.
