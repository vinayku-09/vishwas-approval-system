/**
 * config.ts - Route for the read-only head office Configuration endpoint.
 *
 * Exposes routes, stage timelines, reminder tiers, escalation matrix and renewal periods.
 * Each configuration block is explicitly labelled "placeholder pending APH".
 */

import { Hono } from 'hono';
import { authMiddleware } from '../middleware/auth.js';
import { APPROVAL_ROUTES } from '../config/routes.js';
import {
  DEFAULT_STAGE_DAYS,
  ROUTE_STAGE_DAYS,
  APPROACHING_DAYS_LEFT,
  APPROACHING_THRESHOLD_FRACTION,
  AGEING_BUCKET_EDGES,
  SLA_CONFIG_NOTE,
} from '../config/sla-config.js';
import {
  SLA_WINDOW_DAYS_NEW,
  SLA_WINDOW_DAYS_EXTENSION,
  SLA_WINDOW_DAYS_INTAKE_CHANGE,
  SLA_WARNING_THRESHOLD,
  EXPIRY_TIERS,
  RULE_MIN_LAND_AREA_SQM,
} from '../config/timelines.js';
import {
  ALERT_REMINDER_OFFSETS_DAYS,
  ALERT_REMINDER_RECIPIENT_ROLE,
  ESCALATION_MATRIX,
} from '../config/alerts.js';
import {
  DEFAULT_UNDERTAKING_DURATION_DAYS,
  UNDERTAKING_CATEGORY_DURATIONS,
  DEFAULT_RENEWAL_VALIDITY_DAYS,
  RENEWAL_VALIDITY_PERIODS,
} from '../config/undertakings.js';

export const configRouter = new Hono();

configRouter.use('*', authMiddleware);

configRouter.get('/', (c) => {
  const user = c.get('user');

  return c.json({
    readOnly: true,
    policyStatus: 'placeholder pending APH',
    generalNotice:
      'All approval routes, stage timelines, reminder tiers, escalation rules and renewal validity periods are placeholders pending the AICTE Approval Process Handbook (APH) and are subject to regulatory sign-off before production use.',
    accessedBy: {
      role: user.role,
      name: user.name,
      region: user.region || 'ALL',
    },

    // 1. Approval Routes
    routes: {
      label: 'placeholder pending APH',
      notice: 'Stage sequences and return targets pending official APH approval route specifications.',
      items: Object.values(APPROVAL_ROUTES).map((route) => ({
        id: route.id,
        name: route.name,
        description: route.description,
        applicationTypes: route.applicationTypes,
        stages: route.stages,
        requiresEvc: route.requiresEvc,
        decisionStage: route.decisionStage,
        status: 'placeholder pending APH',
      })),
    },

    // 2. Stage Timelines & SLA
    stageTimelines: {
      label: 'placeholder pending APH',
      notice: SLA_CONFIG_NOTE,
      defaultDaysPerStage: DEFAULT_STAGE_DAYS,
      routeDaysPerStage: ROUTE_STAGE_DAYS,
      slaWindowsDays: {
        NEW: SLA_WINDOW_DAYS_NEW,
        EXTENSION_OF_APPROVAL: SLA_WINDOW_DAYS_EXTENSION,
        INTAKE_CHANGE: SLA_WINDOW_DAYS_INTAKE_CHANGE,
      },
      warningThresholdFraction: SLA_WARNING_THRESHOLD,
      approachingDaysLeft: APPROACHING_DAYS_LEFT,
      ageingBucketEdgesDays: AGEING_BUCKET_EDGES,
      minLandAreaSqmNorm: RULE_MIN_LAND_AREA_SQM,
      status: 'placeholder pending APH',
    },

    // 3. Reminder Tiers
    reminderTiers: {
      label: 'placeholder pending APH',
      notice: 'Document expiry warning tiers and alert reminder cadences pending APH calendar guidelines.',
      documentExpiryTiersDays: EXPIRY_TIERS,
      reminderOffsetsDays: ALERT_REMINDER_OFFSETS_DAYS,
      reminderCadenceDescription:
        'Reminders dispatch at 30, 15, 7, and 1 day(s) before regulatory due date.',
      defaultRecipientRoles: ALERT_REMINDER_RECIPIENT_ROLE,
      status: 'placeholder pending APH',
    },

    // 4. Escalation Matrix
    escalationMatrix: {
      label: 'placeholder pending APH',
      notice: 'Cumulative escalation hierarchy (Levels 1 to 3) pending AICTE administrative delegation order.',
      matrix: ESCALATION_MATRIX.map((rule) => ({
        ...rule,
        delayDescription: `${rule.delayDays} day(s) after due date`,
        status: 'placeholder pending APH',
      })),
      hierarchy: [
        { level: 1, target: 'Regional Officer / Institution', delay: 'Immediate / 1-2 days' },
        { level: 2, target: 'Bureau Officer / Chief', delay: '2-3 days' },
        { level: 3, target: 'Head Office (Chief)', delay: '5-7 days' },
      ],
      status: 'placeholder pending APH',
    },

    // 5. Renewal Periods & Undertakings
    renewalPeriods: {
      label: 'placeholder pending APH',
      notice: 'Statutory validity extensions and commitment cure windows pending state authority norms.',
      statutoryValidityDaysByDocType: RENEWAL_VALIDITY_PERIODS,
      defaultRenewalValidityDays: DEFAULT_RENEWAL_VALIDITY_DAYS,
      defaultUndertakingDurationDays: DEFAULT_UNDERTAKING_DURATION_DAYS,
      categoryDurationsDays: UNDERTAKING_CATEGORY_DURATIONS,
      status: 'placeholder pending APH',
    },
  });
});

export default configRouter;
