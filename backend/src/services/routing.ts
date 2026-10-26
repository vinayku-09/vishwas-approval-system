/**
 * routing.ts — Resolves the configured route, current stage and safe automatic
 * next stage for an application. No handler hard-codes a stage list.
 */

import type { Application, ApprovalRouteId, RouteState, Status } from '../types.js';
import {
  APPROVAL_ROUTES,
  RETURN_CATEGORIES,
  RETURN_TARGETS,
  TYPE_ROUTE_MAP,
  type ApprovalRouteDefinition,
} from '../config/routes.js';
import { getNextStatuses, canTransition } from './workflow.js';

const APPEAL_STATUSES: Status[] = ['APPEAL_SHC', 'APPEAL_SAC'];

export function getRouteId(application: Application): ApprovalRouteId {
  if (APPEAL_STATUSES.includes(application.status)) return 'APPEAL';
  return TYPE_ROUTE_MAP[application.type] ?? 'NEW_APPROVAL';
}

export function getRouteDefinition(application: Application): ApprovalRouteDefinition {
  return APPROVAL_ROUTES[getRouteId(application)];
}

export function getCurrentStage(
  application: Application,
  route = getRouteDefinition(application)
): Status {
  if (route.stages.includes(application.status)) return application.status;
  if (application.status === 'DEFICIENT') return 'SCRUTINY';
  if (application.status === 'APPROVED' || application.status === 'REJECTED') {
    return route.decisionStage;
  }
  return route.stages[route.stages.length - 1] ?? application.status;
}

/**
 * Returns a stage the system may advance to without making a human decision.
 * EVC_REQUIRED and DECISION are intentionally excluded: they require an
 * inspection report or a competent-authority decision respectively.
 */
export function getAutoNextStatus(application: Application): Status | null {
  const route = getRouteDefinition(application);
  let candidate: Status | null = null;

  switch (application.status) {
    case 'SUBMITTED':
      candidate = 'SCRUTINY';
      break;
    case 'DEFICIENT':
      candidate = 'SCRUTINY';
      break;
    case 'SCRUTINY':
      if (application.deficiencies.length > 0) {
        candidate = 'DEFICIENT';
      } else {
        candidate = route.requiresEvc ? 'EVC_REQUIRED' : 'DECISION';
      }
      break;
    case 'EVC_DONE':
      candidate = 'DECISION';
      break;
    default:
      candidate = null;
  }

  return candidate && canTransition(application.status, candidate) ? candidate : null;
}

export function getReturnTargets(status: Status): Status[] {
  return RETURN_TARGETS[status] ?? [];
}

export function getRouteState(application: Application): RouteState {
  const route = getRouteDefinition(application);
  const currentStage = getCurrentStage(application, route);
  const currentIndex = route.stages.indexOf(currentStage);
  const autoNextStatus = getAutoNextStatus(application);

  return {
    id: route.id,
    name: route.name,
    description: route.description,
    stages: [...route.stages],
    currentStage,
    currentIndex,
    nextStatuses: getNextStatuses(application.status),
    autoNextStatus: autoNextStatus ?? undefined,
    returnTargets: getReturnTargets(application.status),
    returnCategories: RETURN_CATEGORIES,
  };
}

/** Attaches derived (non-persisted) route metadata to an API response. */
export function decorateApplication<T extends Application>(application: T): T & { route: RouteState } {
  return { ...application, route: getRouteState(application) };
}
