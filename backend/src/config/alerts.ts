/**
 * alerts.ts - Single source of truth for the Vishwas alert & escalation engine.
 *
 * This file defines:
 *   1. Reminder offsets (days before a due date) for every open item category.
 *   2. The escalation matrix (event type, level, delay after due date,
 *      recipient role and region).
 *
 * The engine (services/alerts.ts) and cron route import these values only, so
 * changing alert policy never requires touching dispatch logic.
 */

import { AlertEventType, Region, UserRole } from '../types.js';

/**
 * Days before a due date at which reminders fire. Each offset fires at most
 * once per open item (idempotency key = eventId:REMINDER:<offset>).
 */
export const ALERT_REMINDER_OFFSETS_DAYS: readonly number[] = [30, 15, 7, 1];

/** Default recipient role for each reminder category. */
export const ALERT_REMINDER_RECIPIENT_ROLE: Record<AlertEventType, UserRole> = {
  PENDENCY: 'OFFICER',
  EVC_SCHEDULING: 'OFFICER',
  REPORT_SUBMISSION: 'COMMITTEE',
  UNDERTAKING: 'INSTITUTION',
  DOCUMENT_EXPIRY: 'INSTITUTION',
  DOCUMENT_AUTHENTICITY: 'OFFICER',
};

export interface EscalationRule {
  eventType: AlertEventType;
  level: number;
  /** Days after the due date before this level is raised. */
  delayDays: number;
  recipientRole: UserRole;
  /** 'ALL' inherits the open item's region; otherwise pins the escalation region. */
  region: Region | 'ALL';
}

/**
 * Escalation matrix. Levels are cumulative: when an item is N days overdue,
 * every rule whose delayDays <= N is raised (each exactly once).
 */
export const ESCALATION_MATRIX: readonly EscalationRule[] = [
  // Application pendency beyond SLA
  { eventType: 'PENDENCY', level: 1, delayDays: 1, recipientRole: 'OFFICER', region: 'ALL' },
  { eventType: 'PENDENCY', level: 2, delayDays: 3, recipientRole: 'CHIEF', region: 'ALL' },
  { eventType: 'PENDENCY', level: 3, delayDays: 7, recipientRole: 'CHIEF', region: 'ALL' },

  // EVC inspection not scheduled
  { eventType: 'EVC_SCHEDULING', level: 1, delayDays: 1, recipientRole: 'OFFICER', region: 'ALL' },
  { eventType: 'EVC_SCHEDULING', level: 2, delayDays: 3, recipientRole: 'CHIEF', region: 'ALL' },

  // EVC report not submitted after inspection
  { eventType: 'REPORT_SUBMISSION', level: 1, delayDays: 2, recipientRole: 'OFFICER', region: 'ALL' },
  { eventType: 'REPORT_SUBMISSION', level: 2, delayDays: 5, recipientRole: 'CHIEF', region: 'ALL' },

  // Institutional undertaking pending
  { eventType: 'UNDERTAKING', level: 1, delayDays: 1, recipientRole: 'INSTITUTION', region: 'ALL' },
  { eventType: 'UNDERTAKING', level: 2, delayDays: 3, recipientRole: 'OFFICER', region: 'ALL' },
  { eventType: 'UNDERTAKING', level: 3, delayDays: 7, recipientRole: 'CHIEF', region: 'ALL' },

  // Compliance document expiry
  { eventType: 'DOCUMENT_EXPIRY', level: 1, delayDays: 0, recipientRole: 'INSTITUTION', region: 'ALL' },
  { eventType: 'DOCUMENT_EXPIRY', level: 2, delayDays: 2, recipientRole: 'OFFICER', region: 'ALL' },
  { eventType: 'DOCUMENT_EXPIRY', level: 3, delayDays: 5, recipientRole: 'CHIEF', region: 'ALL' },

  // Document authenticity verification (Phase C placeholder)
  { eventType: 'DOCUMENT_AUTHENTICITY', level: 1, delayDays: 1, recipientRole: 'OFFICER', region: 'ALL' },
  { eventType: 'DOCUMENT_AUTHENTICITY', level: 2, delayDays: 3, recipientRole: 'CHIEF', region: 'WEST' },
];

/** Maximum escalation level defined by the matrix. */
export const MAX_ESCALATION_LEVEL = Math.max(...ESCALATION_MATRIX.map((rule) => rule.level));

/** Base URL used in alert emails. Body contains ONLY app id, reason and this link. */
export function getPortalUrl(): string {
  return (process.env.PORTAL_URL || 'http://localhost:3000').replace(/\/+$/, '');
}

/** Returns the configured mail mode (defaults to safe 'log' mode). */
export function getMailMode(): 'live' | 'log' | 'ethereal' {
  const raw = (process.env.MAIL_MODE || 'log').toLowerCase();
  if (raw === 'live' || raw === 'ethereal') {
    return raw;
  }
  return 'log';
}
