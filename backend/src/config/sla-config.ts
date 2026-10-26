/**
 * sla-config.ts - Route-derived stage SLA configuration for pendency dashboards.
 *
 * Stage names are derived from APPROVAL_ROUTES (the four PS routes). Every value
 * is a placeholder pending the AICTE Approval Process Handbook (APH) and must
 * be reviewed before production use.
 *
 * The configuration covers: placeholder days per stage and per route, the
 * approaching threshold, ageing bucket edges. All values are marked
 * placeholder pending APH. Dashboards must visibly show this note.
 */

import type { ApprovalRouteId, Status } from '../types.js';
import { APPROVAL_ROUTES } from './routes.js';

export const SLA_CONFIG_NOTE =
  'Placeholder timelines pending APH. Stage SLA days, approaching threshold and ageing bucket edges are placeholders pending the AICTE Approval Process Handbook (APH).';

/**
 * Approaching threshold as fraction of window elapsed (mirrors existing pattern)
 * or as days-left threshold. We support both semantics; default uses days-left
 * approaching when daysLeft <= APPROACHING_DAYS_LEFT.
 */
export const APPROACHING_THRESHOLD_FRACTION = 0.8;
export const APPROACHING_DAYS_LEFT = 3; // placeholder pending APH

/**
 * Ageing bucket edges in days (placeholder pending APH).
 * Buckets: 0-3, 4-7, 8-14, 15-30, >30
 */
export const AGEING_BUCKET_EDGES = [3, 7, 14, 30] as const;

export type AgeingBucket =
  | '0-3'
  | '4-7'
  | '8-14'
  | '15-30'
  | '>30';

/**
 * Default placeholder days per stage (calendar days). These are placeholders
 * pending APH; values may be overridden per route.
 */
export const DEFAULT_STAGE_DAYS: Record<Status, number> = {
  SUBMITTED: 2,      // placeholder pending APH
  SCRUTINY: 5,       // placeholder pending APH
  DEFICIENT: 3,      // placeholder pending APH
  EVC_REQUIRED: 7,   // placeholder pending APH
  EVC_DONE: 3,       // placeholder pending APH
  DECISION: 5,       // placeholder pending APH
  APPROVED: 0,       // terminal
  REJECTED: 0,       // terminal
  APPEAL_SHC: 5,     // placeholder pending APH
  APPEAL_SAC: 5,     // placeholder pending APH
};

/**
 * Per-route placeholder days. Stage names are copied from APPROVAL_ROUTES so
 * this map cannot drift from the four PS route definitions.
 */
export const ROUTE_STAGE_DAYS: Record<ApprovalRouteId, Partial<Record<Status, number>>> =
  Object.fromEntries(
    Object.values(APPROVAL_ROUTES).map((route) => [
      route.id,
      Object.fromEntries(route.stages.map((stage) => [stage, DEFAULT_STAGE_DAYS[stage] ?? 0])),
    ])
  ) as Record<ApprovalRouteId, Partial<Record<Status, number>>>;

/**
 * Get all stage names that appear across all routes (route-derived).
 * This ensures we don't duplicate stage names manually.
 */
export function getAllRouteStages(): Status[] {
  const stages = new Set<Status>();
  for (const route of Object.values(APPROVAL_ROUTES)) {
    for (const stage of route.stages) {
      stages.add(stage);
    }
  }
  // Also include common terminal/side states that appear in workflow
  stages.add('DEFICIENT');
  stages.add('APPROVED');
  stages.add('REJECTED');
  return Array.from(stages);
}

/**
 * Get stage SLA days for a given route and stage.
 */
export function getStageDays(routeId: ApprovalRouteId, stage: Status): number {
  const routeOverrides = ROUTE_STAGE_DAYS[routeId] || {};
  if (routeOverrides[stage] !== undefined) {
    return routeOverrides[stage] as number;
  }
  return DEFAULT_STAGE_DAYS[stage] ?? 0;
}

/**
 * Compute total SLA days for a route from start to decision stage (sum of stages in route).
 * Used as placeholder budget; actual computation uses per-stage ageing.
 */
export function getRouteTotalDays(routeId: ApprovalRouteId): number {
  const route = APPROVAL_ROUTES[routeId];
  let total = 0;
  for (const stage of route.stages) {
    total += getStageDays(routeId, stage);
  }
  return total;
}

export function getAgeingBucket(ageDays: number): AgeingBucket {
  if (ageDays <= AGEING_BUCKET_EDGES[0]) return '0-3';
  if (ageDays <= AGEING_BUCKET_EDGES[1]) return '4-7';
  if (ageDays <= AGEING_BUCKET_EDGES[2]) return '8-14';
  if (ageDays <= AGEING_BUCKET_EDGES[3]) return '15-30';
  return '>30';
}

export type PendencyStatus = 'On time' | 'Approaching' | 'Overdue';

export interface PendencyInfo {
  ageDays: number;      // calendar days elapsed since createdAt
  daysLeft: number;     // calendar days until due
  status: PendencyStatus;
  dueDate: string;      // ISO date string
  stageDays: number;    // SLA days for current stage
  routeTotalDays: number;
  ageingBucket: AgeingBucket;
}

function msToDays(ms: number): number {
  return Math.ceil(ms / (1000 * 60 * 60 * 24));
}

function msToDaysFloor(ms: number): number {
  return Math.floor(ms / (1000 * 60 * 60 * 24));
}

/**
 * Compute pendency info for an application.
 * Uses route-derived stage SLA config.
 */
export function computePendency(
  createdAt: string,
  currentDate: Date = new Date(),
  routeId: ApprovalRouteId = 'SCRUTINY_EVC',
  currentStage: Status = 'SUBMITTED'
): PendencyInfo {
  const start = new Date(createdAt).getTime();
  const now = currentDate.getTime();
  const elapsedMs = Math.max(0, now - start);
  const ageDays = msToDaysFloor(elapsedMs); // whole days elapsed
  
  const stageDays = getStageDays(routeId, currentStage);
  const routeTotalDays = getRouteTotalDays(routeId);
  
  // Due date based on route total days from creation (placeholder)
  const dueMs = start + routeTotalDays * 24 * 60 * 60 * 1000;
  const dueDate = new Date(dueMs).toISOString();
  const remainingMs = dueMs - now;
  const daysLeft = msToDays(remainingMs);
  
  let status: PendencyStatus = 'On time';
  if (now > dueMs) {
    status = 'Overdue';
  } else if (daysLeft <= APPROACHING_DAYS_LEFT || (ageDays / Math.max(1, routeTotalDays)) > APPROACHING_THRESHOLD_FRACTION) {
    status = 'Approaching';
  } else {
    status = 'On time';
  }
  
  return {
    ageDays,
    daysLeft,
    status,
    dueDate,
    stageDays,
    routeTotalDays,
    ageingBucket: getAgeingBucket(ageDays),
  };
}
