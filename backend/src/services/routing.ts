/**
 * routing.ts - Resolves the configured route, current stage and safe automatic
 * next stage for an application. No handler hard-codes a stage list.
 */

import type { Application, ApprovalRouteId, RouteState, Status } from '../types.js';
import {
  APPROVAL_ROUTES,
  RETURN_CATEGORIES,
  RETURN_TARGETS,
  STATUS_ROUTE_MAP,
  TYPE_ROUTE_MAP,
  type ApprovalRouteDefinition,
} from '../config/routes.js';
import { getNextStatuses, canTransition } from './workflow.js';

export function getRouteId(application: Application): ApprovalRouteId {
  return (
    STATUS_ROUTE_MAP[application.status] ??
    TYPE_ROUTE_MAP[application.type] ??
    'SCRUTINY_EVC'
  );
}

export function getRouteDefinition(application: Application): ApprovalRouteDefinition {
  return APPROVAL_ROUTES[getRouteId(application)];
}

export function getCurrentStage(
  application: Application,
  route = getRouteDefinition(application)
): Status {
  if (route.stages.includes(application.status)) return application.status;
  if (application.status === 'DEFICIENT') {
    return route.stages.includes('SCRUTINY')
      ? 'SCRUTINY'
      : route.stages[0] ?? application.status;
  }
  if (application.status === 'APPROVED' || application.status === 'REJECTED') {
    return route.decisionStage;
  }
  return route.stages[route.stages.length - 1] ?? application.status;
}

function getForwardStage(
  application: Application,
  route: ApprovalRouteDefinition
): Status | null {
  const currentIndex = route.stages.indexOf(application.status);
  if (currentIndex < 0 || currentIndex >= route.stages.length - 1) return null;
  return route.stages[currentIndex + 1];
}

/**
 * Next stages allowed by both the global transition table and the selected
 * route. DEFICIENT remains a correction side-state even when the route has no
 * scrutiny stage.
 */
export function getRouteNextStatuses(application: Application): Status[] {
  const route = getRouteDefinition(application);
  const globalNext = getNextStatuses(application.status);
  const forward = getForwardStage(application, route);

  switch (application.status) {
    case 'SUBMITTED':
      return forward && canTransition(application.status, forward) ? [forward] : [];
    case 'SCRUTINY': {
      const candidates: Status[] = ['DEFICIENT'];
      if (forward) candidates.push(forward);
      return candidates.filter((status) =>
        canTransition(application.status, status)
      );
    }
    case 'DEFICIENT':
      return route.stages.includes('SCRUTINY') ? ['SCRUTINY'] : [];
    case 'EVC_REQUIRED':
    case 'EVC_DONE':
      return forward && canTransition(application.status, forward) ? [forward] : [];
    case 'DECISION':
      return globalNext.filter(
        (status) => status === 'APPROVED' || status === 'REJECTED'
      );
    case 'REJECTED':
    case 'APPEAL_SHC':
    case 'APPEAL_SAC':
      return globalNext;
    default:
      return [];
  }
}

/**
 * Returns a stage the system may advance to without making a human decision.
 * EVC_REQUIRED and DECISION are intentionally excluded: they require an
 * inspection report or a competent-authority decision respectively.
 */
export function getAutoNextStatus(application: Application): Status | null {
  const route = getRouteDefinition(application);
  const forward = getForwardStage(application, route);
  let candidate: Status | null = null;

  switch (application.status) {
    case 'SUBMITTED':
    case 'EVC_DONE':
      candidate = forward;
      break;
    case 'DEFICIENT':
      candidate = route.stages.includes('SCRUTINY') ? 'SCRUTINY' : null;
      break;
    case 'SCRUTINY':
      candidate = application.deficiencies.length > 0 ? 'DEFICIENT' : forward;
      break;
    default:
      candidate = null;
  }

  return candidate && getRouteNextStatuses(application).includes(candidate)
    ? candidate
    : null;
}

/**
 * Status after a scrutiny/extraction pass. Deficiencies always branch to the
 * correction side-state; otherwise the configured route decides whether EVC or
 * decision follows.
 */
export function getPostScrutinyStatus(
  application: Application,
  hasDeficiencies: boolean
): Status {
  if (hasDeficiencies) return 'DEFICIENT';

  const route = getRouteDefinition(application);
  const currentIndex = route.stages.indexOf(application.status);
  const afterCurrent = route.stages.find(
    (stage, index) =>
      index > currentIndex && (stage === 'EVC_REQUIRED' || stage === 'DECISION')
  );

  return afterCurrent ?? (route.requiresEvc ? 'EVC_REQUIRED' : 'DECISION');
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
    nextStatuses: getRouteNextStatuses(application),
    autoNextStatus: autoNextStatus ?? undefined,
    returnTargets: getReturnTargets(application.status),
    returnCategories: RETURN_CATEGORIES,
  };
}

/** Attaches derived (non-persisted) route metadata to an API response. */
export function decorateApplication<T extends Application>(application: T): T & { route: RouteState } {
  return { ...application, route: getRouteState(application) };
}
