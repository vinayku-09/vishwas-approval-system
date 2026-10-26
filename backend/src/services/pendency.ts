/**
 * pendency.ts - Pendency calculation service using route-derived SLA config.
 */

import type { Application, ApprovalRouteId, Status } from '../types.js';
import { getRouteDefinition } from './routing.js';
import { computePendency, type PendencyInfo, SLA_CONFIG_NOTE } from '../config/sla-config.js';

export function getApplicationPendency(
  application: Application,
  currentDate: Date = new Date()
): PendencyInfo & { note: string; routeId: ApprovalRouteId; currentStage: Status } {
  const route = getRouteDefinition(application);
  const routeId = route.id;
  // Determine current stage
  let currentStage: Status = application.status;
  if (route.stages.includes(application.status)) {
    currentStage = application.status;
  } else if (application.status === 'DEFICIENT') {
    currentStage = route.stages.includes('SCRUTINY') ? 'SCRUTINY' : route.stages[0];
  } else if (application.status === 'APPROVED' || application.status === 'REJECTED') {
    currentStage = route.decisionStage;
  } else {
    currentStage = route.stages[route.stages.length - 1] || application.status;
  }
  
  const pendency = computePendency(application.createdAt, currentDate, routeId, currentStage);
  return {
    ...pendency,
    note: SLA_CONFIG_NOTE,
    routeId,
    currentStage,
  };
}

export { SLA_CONFIG_NOTE } from '../config/sla-config.js';
export type { PendencyInfo, PendencyStatus, AgeingBucket } from '../config/sla-config.js';
