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

## Part 2b PS Route and Return Placeholders

| Area | Placeholder value | Config location | PS area served |
| :--- | :--- | :--- | :--- |
| `ONLY_SCRUTINY` route | `EXTENSION_OF_APPROVAL`; stages `SUBMITTED -> SCRUTINY -> DECISION`; no EVC | `backend/src/config/routes.ts` (`APPROVAL_ROUTES`, `TYPE_ROUTE_MAP`) | A - routing |
| `SCRUTINY_EVC` route | `NEW`; stages `SUBMITTED -> SCRUTINY -> EVC_REQUIRED -> EVC_DONE -> DECISION`; EVC required | `backend/src/config/routes.ts` | A - routing |
| `EVC_SAC_SHC` route | `APPEAL` and rejected/appeal statuses; stages `SUBMITTED -> SCRUTINY -> EVC_REQUIRED -> EVC_DONE -> DECISION -> APPEAL_SHC -> APPEAL_SAC`; EVC required | `backend/src/config/routes.ts` (`TYPE_ROUTE_MAP`, `STATUS_ROUTE_MAP`) | A - routing and appeal |
| `ONLY_EVC` route | `INTAKE_CHANGE`; stages `SUBMITTED -> EVC_REQUIRED -> EVC_DONE -> DECISION`; no separate scrutiny stage | `backend/src/config/routes.ts` | A - routing |
| Route stage order | The four route `stages` arrays are the canonical stage names for future stage-SLA configuration | `backend/src/config/routes.ts` (`APPROVAL_ROUTES`) | A - routing and Part 3 SLA |
| Automatic progression | `SUBMITTED ->` next configured stage, `DEFICIENT -> SCRUTINY` where configured, `SCRUTINY -> DEFICIENT` when deficiencies exist, otherwise the next configured EVC/decision stage, `EVC_DONE -> DECISION`; no automatic decision | `backend/src/config/routes.ts` and `backend/src/services/routing.ts` | A - stage progression |
| Route-aware validation | A globally valid transition is rejected when it is not in the selected route | `backend/src/services/routing.ts` and `backend/src/routes/applications.ts` | A - stage progression |
| Return targets | Explicit earlier targets only: `SCRUTINY -> [SUBMITTED, DEFICIENT]`, `DEFICIENT -> [SCRUTINY]`, `EVC_REQUIRED -> [SCRUTINY, DEFICIENT]`, `EVC_DONE -> [EVC_REQUIRED, SCRUTINY, DEFICIENT]`, `DECISION -> [EVC_DONE, EVC_REQUIRED, SCRUTINY, DEFICIENT]` | `backend/src/config/routes.ts` (`RETURN_TARGETS`) | A - return/revert |
| Return categories | `DEFICIENCY`, `DOCUMENT_MISSING`, `CLARIFICATION`, `COMPLIANCE`, `OTHER` | `backend/src/config/routes.ts` (`RETURN_CATEGORIES`) | A - return/revert |
| Notice wording and reference format | Standard return/decision notice text, `AICTE/VISHWAS/<kind>/<applicationId>/<timestamp>` references and institution notification copy | `backend/src/services/notices.ts` | A - notices |
| Human-decision notice | Text shown on decision and case-summary screens | `backend/src/config/routes.ts` (`SAFEGUARD_NOTICE`) | A / Safeguard |

Route metadata is derived at response time and not persisted. Returns are stored in the application JSONB payload; no separate table or migration is required. These values are prototype assumptions, not official AICTE route mappings. `EVC_SAC_SHC` follows the existing SHC-then-SAC state-machine order even though the PS route name lists SAC/SHC.

## Implementation Status and Remaining Gaps

| Concern | Status | Location or plan |
| :--- | :--- | :--- |
| Four PS approval routes and full stage sequences | Built with placeholders | `backend/src/config/routes.ts` (`APPROVAL_ROUTES`) |
| Application-type route mapping, including first-class `APPEAL`, and rejected/appeal override | Built with placeholders | `backend/src/config/routes.ts` (`TYPE_ROUTE_MAP`, `STATUS_ROUTE_MAP`) |
| Route sequence in institution application view, officer advance view and case summary | Built | `frontend/src/components/RouteSequence.tsx` |
| Stage SLA days (by route stage) | SUBMITTED 2, SCRUTINY 5, EVC_REQUIRED 7, EVC_DONE 3, DECISION 5, APPEAL_SHC 5, APPEAL_SAC 5, DEFICIENT 3 (calendar days). Placeholder pending APH. | `backend/src/config/sla-config.ts` (`DEFAULT_STAGE_DAYS`, `ROUTE_STAGE_DAYS` derived from `APPROVAL_ROUTES`) | B - pendency |
| Approaching threshold | 3 days left, or 80% of the route window elapsed. Placeholder pending APH. | `backend/src/config/sla-config.ts` (`APPROACHING_DAYS_LEFT`, `APPROACHING_THRESHOLD_FRACTION`) | B - pendency |
| Ageing bucket edges | 0-3, 4-7, 8-14, 15-30, >30 calendar days. Edges at 3, 7, 14, 30. Placeholder pending APH. | `backend/src/config/sla-config.ts` (`AGEING_BUCKET_EDGES`) | B - pendency |
| Undertaking due-date rules | Not built | Part 4 config/model |
| Renewal validity periods | Not built | Part 4 config/model |

## Other Assumptions

- Demo institutions, applications, documents, inspections, users and alerts are simulated and contain no real personal data.
- AI extraction is a deterministic mock unless `AI_GATEWAY_API_KEY` is configured.
- The Python OR-Tools optimizer is unverified in this environment; the tested scheduler is the TypeScript fallback.
- Email delivery was verified with Ethereal only. Live SMTP is unverified.
- The current seeded data is intentionally reset by `db:seed`; do not run the seed against a database containing records that must be preserved.
