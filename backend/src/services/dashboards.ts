/**
 * dashboards.ts - Dashboard service for pendency dashboards and EVC board.
 */

import type { AuthTokenPayload, Status } from '../types.js';
import { store } from '../db/store.js';
import { canReadApplication } from './access.js';
import { getApplicationPendency, SLA_CONFIG_NOTE } from './pendency.js';
import type { PendencyStatus } from '../config/sla-config.js';
import { getRouteDefinition } from './routing.js';

export type DashboardRoleView =
  | 'regional_officer'
  | 'bureau_officer'
  | 'committee'
  | 'head_office'
  | 'institution';

export interface DashboardFilters {
  region?: string;
  /** Pendency status: On time / Approaching / Overdue */
  status?: PendencyStatus;
  stage?: string;
  officerId?: string;
}

export function dashboardRoleView(user: AuthTokenPayload): DashboardRoleView {
  if (user.role === 'CHIEF') return 'head_office';
  if (user.role === 'COMMITTEE') return 'committee';
  if (user.role === 'INSTITUTION') return 'institution';
  if (user.role === 'OFFICER' && user.region && user.region !== 'ALL') return 'regional_officer';
  return 'bureau_officer';
}

export interface PendencyDashboard {
  note: string;
  generatedAt: string;
  countsByStage: Record<string, number>;
  countsByRegion: Record<string, number>;
  ageingBuckets: Record<string, number>;
  workloadPerOfficer: Record<string, number>;
  bottleneckStages: Array<{ stage: string; count: number }>;
  pendingCases: Array<{
    applicationId: string;
    institutionName: string;
    status: Status;
    region?: string;
    routeId: string;
    currentStage: string;
    ageDays: number;
    daysLeft: number;
    pendencyStatus: string;
    ageingBucket: string;
  }>;
  total: number;
  roleView: DashboardRoleView;
  workloadPerCommittee: Record<string, number>;
}

export interface EvcBoard {
  note: string;
  generatedAt: string;
  awaitingEvc: number;
  scheduled: number;
  completed: number;
  delayed: number;
  items: Array<{
    applicationId: string;
    institutionName: string;
    status: Status;
    region?: string;
    scheduledDate?: string;
    reportDueAt?: string;
    daysOverdue: number;
    delayed: boolean;
  }>;
  roleView: DashboardRoleView;
}

/**
 * Build pendency dashboard scoped to user.
 */
export async function buildPendencyDashboard(
  user: AuthTokenPayload,
  filters: DashboardFilters = {}
): Promise<PendencyDashboard> {
  const allApps = await store.listApplications();
  const scopedApps = allApps.filter((app) => canReadApplication(user, app));

  let filtered = scopedApps;
  if (filters.region && filters.region !== 'ALL') {
    filtered = filtered.filter((app) => app.region === filters.region || app.region === 'ALL');
  }

  const pendingCases: PendencyDashboard['pendingCases'] = [];
  const countsByStage: Record<string, number> = {};
  const countsByRegion: Record<string, number> = {};
  const ageingBuckets: Record<string, number> = {};
  const workloadPerOfficer: Record<string, number> = {};
  const workloadPerCommittee: Record<string, number> = {};

  const inspections = await store.getInspections();
  const inspectionMap = new Map(inspections.map((i) => [i.applicationId, i]));

  for (const app of filtered) {
    if (app.status === 'APPROVED' || app.status === 'REJECTED') continue;

    const pendency = getApplicationPendency(app);
    const route = getRouteDefinition(app);

    if (filters.stage && app.status !== filters.stage && pendency.currentStage !== filters.stage) {
      continue;
    }
    if (filters.status && pendency.status !== filters.status) {
      continue;
    }

    const insp = inspectionMap.get(app.id);
    if (filters.officerId) {
      const inspectorMatch = insp?.inspectors?.some(
        (inspector) => inspector.id === filters.officerId || inspector.name === filters.officerId
      );
      const officerBucket = `Officer-${app.region || 'ALL'}` === filters.officerId;
      if (!inspectorMatch && !officerBucket) continue;
    }
    
    pendingCases.push({
      applicationId: app.id,
      institutionName: app.institutionName,
      status: app.status,
      region: app.region,
      routeId: route.id,
      currentStage: pendency.currentStage,
      ageDays: pendency.ageDays,
      daysLeft: pendency.daysLeft,
      pendencyStatus: pendency.status,
      ageingBucket: pendency.ageingBucket,
    });
    
    countsByStage[pendency.currentStage] = (countsByStage[pendency.currentStage] || 0) + 1;
    countsByRegion[app.region || 'ALL'] = (countsByRegion[app.region || 'ALL'] || 0) + 1;
    ageingBuckets[pendency.ageingBucket] = (ageingBuckets[pendency.ageingBucket] || 0) + 1;
    
    if (insp && insp.inspectors && insp.inspectors.length > 0) {
      for (const inspector of insp.inspectors) {
        workloadPerOfficer[inspector.name] = (workloadPerOfficer[inspector.name] || 0) + 1;
        workloadPerCommittee[inspector.name] = (workloadPerCommittee[inspector.name] || 0) + 1;
      }
    } else {
      const key = `Officer-${app.region || 'ALL'}`;
      workloadPerOfficer[key] = (workloadPerOfficer[key] || 0) + 1;
    }
  }
  
  // Find bottleneck stages (top 3 by count)
  const bottleneckStages = Object.entries(countsByStage)
    .map(([stage, count]) => ({ stage, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 3);
  
  return {
    note: SLA_CONFIG_NOTE,
    generatedAt: new Date().toISOString(),
    countsByStage,
    countsByRegion,
    ageingBuckets,
    workloadPerOfficer,
    bottleneckStages,
    pendingCases: pendingCases.sort((a, b) => b.ageDays - a.ageDays),
    total: pendingCases.length,
    roleView: dashboardRoleView(user),
    workloadPerCommittee,
  };
}

/**
 * Build EVC board scoped to user.
 * Buckets: awaiting EVC, scheduled, completed, delayed
 * Delayed cases feed alert engine
 */
export async function buildEvcBoard(
  user: AuthTokenPayload,
  filters: Pick<DashboardFilters, 'region'> = {}
): Promise<EvcBoard> {
  const allApps = await store.listApplications();
  const scopedApps = allApps.filter((app) => {
    if (!canReadApplication(user, app)) return false;
    if (filters.region && filters.region !== 'ALL') {
      return app.region === filters.region || app.region === 'ALL';
    }
    return true;
  });
  const inspections = await store.getInspections();
  const inspectionMap = new Map(inspections.map((i) => [i.applicationId, i]));
  
  let awaitingEvc = 0;
  let scheduled = 0;
  let completed = 0;
  let delayed = 0;
  
  const items: EvcBoard['items'] = [];
  const now = new Date();
  
  for (const app of scopedApps) {
    const insp = inspectionMap.get(app.id);
    
    if (app.status === 'EVC_REQUIRED' && !insp) {
      awaitingEvc++;
      items.push({
        applicationId: app.id,
        institutionName: app.institutionName,
        status: app.status,
        region: app.region,
        daysOverdue: 0,
        delayed: false,
      });
    } else if (insp && insp.status === 'SCHEDULED') {
      scheduled++;
      let daysOverdue = 0;
      let isDelayed = false;
      if (insp.reportDueAt) {
        const due = new Date(insp.reportDueAt + 'T00:00:00Z');
        if (now > due) {
          daysOverdue = Math.floor((now.getTime() - due.getTime()) / (1000 * 60 * 60 * 24));
          isDelayed = true;
          delayed++;
        }
      } else if (insp.scheduledDate) {
        // If scheduled in past and no report, consider delayed
        const sched = new Date(insp.scheduledDate + 'T00:00:00Z');
        if (now > sched) {
          daysOverdue = Math.floor((now.getTime() - sched.getTime()) / (1000 * 60 * 60 * 24));
          isDelayed = true;
          delayed++;
        }
      }
      items.push({
        applicationId: app.id,
        institutionName: app.institutionName,
        status: app.status,
        region: app.region,
        scheduledDate: insp.scheduledDate,
        reportDueAt: insp.reportDueAt,
        daysOverdue,
        delayed: isDelayed,
      });
    } else if (insp && insp.status === 'COMPLETED') {
      completed++;
      items.push({
        applicationId: app.id,
        institutionName: app.institutionName,
        status: app.status,
        region: app.region,
        scheduledDate: insp.scheduledDate,
        reportDueAt: insp.reportDueAt,
        daysOverdue: 0,
        delayed: false,
      });
    }
  }
  
  return {
    note: SLA_CONFIG_NOTE,
    generatedAt: new Date().toISOString(),
    awaitingEvc,
    scheduled,
    completed,
    delayed,
    items,
    roleView: dashboardRoleView(user),
  };
}
