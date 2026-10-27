/**
 * reports.ts - Service for generating the six AICTE reports with CSV export and role scoping.
 */

import type {
  Application,
  AuthTokenPayload,
  ComplianceDocument,
  InspectionAssignment,
  Region,
  Undertaking,
} from '../types.js';
import { store } from '../db/store.js';
import { canReadApplication, hasRegionAccess } from './access.js';
import { getRouteDefinition } from './routing.js';
import { getApplicationPendency } from './pendency.js';

export type ReportType =
  | 'application-pendency'
  | 'evc-status'
  | 'undertaking-compliance'
  | 'document-validity'
  | 'overdue-cases'
  | 'region-performance';

export interface ReportColumn {
  key: string;
  label: string;
  align?: 'left' | 'center' | 'right';
}

export interface ReportResult {
  reportType: ReportType;
  title: string;
  generatedAt: string;
  filters: {
    region?: string;
    fromDate?: string;
    toDate?: string;
    [key: string]: string | undefined;
  };
  summary: Record<string, string | number>;
  columns: ReportColumn[];
  rows: Record<string, unknown>[];
}

const ALL_REGIONS: Region[] = ['NORTH', 'SOUTH', 'EAST', 'WEST', 'CENTRAL', 'NORTH_EAST'];

/** Escape a single value for RFC 4180 CSV */
export function escapeCsvValue(val: unknown): string {
  if (val === null || val === undefined) return '';
  const str = String(val);
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/** Convert report columns and rows to an RFC 4180 CSV string */
export function reportToCsv(report: ReportResult): string {
  const headerLine = report.columns.map((c) => escapeCsvValue(c.label)).join(',');
  const rowLines = report.rows.map((row) =>
    report.columns.map((col) => escapeCsvValue(row[col.key])).join(',')
  );
  return [headerLine, ...rowLines].join('\r\n');
}

/** Filter applications by role and region scoping */
export function filterScopedApplications(
  apps: Application[],
  user: AuthTokenPayload,
  regionFilter?: string
): Application[] {
  return apps.filter((app) => {
    if (!canReadApplication(user, app)) return false;
    if (regionFilter && regionFilter !== 'ALL') {
      if (app.region && app.region !== 'ALL' && app.region !== regionFilter) return false;
    }
    return true;
  });
}

/** Helper to filter date ranges */
function matchesDateRange(dateStr?: string, fromDate?: string, toDate?: string): boolean {
  if (!dateStr) return true;
  const d = dateStr.slice(0, 10);
  if (fromDate && d < fromDate) return false;
  if (toDate && d > toDate) return false;
  return true;
}

// ---------------------------------------------------------------------------
// 1. Application Pendency Report
// ---------------------------------------------------------------------------
export async function generateApplicationPendencyReport(
  user: AuthTokenPayload,
  filters: { region?: string; fromDate?: string; toDate?: string }
): Promise<ReportResult> {
  const allApps = await store.listApplications();
  const scopedApps = filterScopedApplications(allApps, user, filters.region).filter((app) =>
    matchesDateRange(app.createdAt, filters.fromDate, filters.toDate)
  );

  const now = new Date();
  let onTime = 0;
  let approaching = 0;
  let overdue = 0;

  const rows = scopedApps.map((app) => {
    const route = getRouteDefinition(app);

    const daysElapsed = Math.max(
      0,
      Math.floor((now.getTime() - new Date(app.createdAt).getTime()) / (24 * 60 * 60 * 1000))
    );

    let slaStatus: 'On time' | 'Approaching' | 'Overdue' = 'On time';
    if (app.status === 'APPROVED' || app.status === 'REJECTED') {
      slaStatus = 'On time';
      onTime += 1;
    } else if (app.slaDueAt) {
      const dueMs = new Date(app.slaDueAt).getTime();
      const remainingDays = Math.ceil((dueMs - now.getTime()) / (24 * 60 * 60 * 1000));
      if (now.getTime() > dueMs) {
        slaStatus = 'Overdue';
        overdue += 1;
      } else if (remainingDays <= 3) {
        slaStatus = 'Approaching';
        approaching += 1;
      } else {
        slaStatus = 'On time';
        onTime += 1;
      }
    } else {
      onTime += 1;
    }

    return {
      applicationId: app.id,
      institutionName: app.institutionName,
      region: app.region || 'ALL',
      routeId: route.id,
      routeName: route.name,
      type: app.type,
      stage: app.status,
      createdAt: app.createdAt.slice(0, 10),
      slaDueAt: app.slaDueAt ? app.slaDueAt.slice(0, 10) : '-',
      daysInStage: daysElapsed,
      slaStatus,
      locked: app.locked ? 'Yes' : 'No',
    };
  });

  return {
    reportType: 'application-pendency',
    title: 'Application Pendency Report',
    generatedAt: now.toISOString(),
    filters,
    summary: {
      totalApplications: scopedApps.length,
      onTime,
      approaching,
      overdue,
    },
    columns: [
      { key: 'applicationId', label: 'Application ID' },
      { key: 'institutionName', label: 'Institution Name' },
      { key: 'region', label: 'Region' },
      { key: 'routeName', label: 'Route' },
      { key: 'type', label: 'Type' },
      { key: 'stage', label: 'Current Stage' },
      { key: 'createdAt', label: 'Created Date' },
      { key: 'slaDueAt', label: 'SLA Due Date' },
      { key: 'daysInStage', label: 'Days in Stage', align: 'right' },
      { key: 'slaStatus', label: 'SLA Status' },
      { key: 'locked', label: 'Locked' },
    ],
    rows,
  };
}

// ---------------------------------------------------------------------------
// 2. EVC Status Report
// ---------------------------------------------------------------------------
export async function generateEvcStatusReport(
  user: AuthTokenPayload,
  filters: { region?: string; fromDate?: string; toDate?: string }
): Promise<ReportResult> {
  const allApps = await store.listApplications();
  const scopedApps = filterScopedApplications(allApps, user, filters.region);
  const now = new Date();
  const nowDateStr = now.toISOString().slice(0, 10);

  // Consider applications that have an inspection or are in EVC route/stage
  const evcApps = scopedApps.filter((app) => {
    const route = getRouteDefinition(app);
    return (
      route.stages.includes('EVC_REQUIRED') ||
      app.status === 'EVC_REQUIRED' ||
      app.status === 'EVC_DONE' ||
      Boolean(app.scheduledInspection)
    );
  }).filter((app) => matchesDateRange(app.createdAt, filters.fromDate, filters.toDate));

  let awaiting = 0;
  let scheduled = 0;
  let completed = 0;
  let delayed = 0;

  const rows = evcApps.map((app) => {
    const insp = app.scheduledInspection;
    let evcStatus: 'Awaiting Scheduling' | 'Scheduled' | 'Completed' | 'Delayed' = 'Awaiting Scheduling';

    if (insp) {
      if (insp.status === 'COMPLETED' || insp.report) {
        evcStatus = 'Completed';
        completed += 1;
      } else if (insp.scheduledDate < nowDateStr && !insp.report) {
        evcStatus = 'Delayed';
        delayed += 1;
      } else {
        evcStatus = 'Scheduled';
        scheduled += 1;
      }
    } else {
      if (app.slaDueAt && app.slaDueAt.slice(0, 10) < nowDateStr) {
        evcStatus = 'Delayed';
        delayed += 1;
      } else {
        evcStatus = 'Awaiting Scheduling';
        awaiting += 1;
      }
    }

    const inspectorsStr = insp?.inspectors?.map((i) => i.name).join('; ') || '-';
    const recStr = insp?.report?.recommendation || '-';
    const reportHashStr = insp?.report?.reportHash ? insp.report.reportHash.slice(0, 16) + '...' : '-';

    return {
      applicationId: app.id,
      institutionName: app.institutionName,
      region: app.region || 'ALL',
      domain: app.domain || 'CSE',
      stage: app.status,
      evcStatus,
      scheduledDate: insp?.scheduledDate || '-',
      inspectors: inspectorsStr,
      recommendation: recStr,
      reportHash: reportHashStr,
    };
  });

  return {
    reportType: 'evc-status',
    title: 'Expert Visit Committee (EVC) Status Report',
    generatedAt: now.toISOString(),
    filters,
    summary: {
      totalCases: rows.length,
      awaitingScheduling: awaiting,
      scheduled,
      completed,
      delayed,
    },
    columns: [
      { key: 'applicationId', label: 'Application ID' },
      { key: 'institutionName', label: 'Institution Name' },
      { key: 'region', label: 'Region' },
      { key: 'domain', label: 'Domain' },
      { key: 'stage', label: 'Current Stage' },
      { key: 'evcStatus', label: 'EVC Status' },
      { key: 'scheduledDate', label: 'Scheduled Date' },
      { key: 'inspectors', label: 'Inspectors' },
      { key: 'recommendation', label: 'Recommendation' },
      { key: 'reportHash', label: 'Report Hash' },
    ],
    rows,
  };
}

// ---------------------------------------------------------------------------
// 3. Undertaking Compliance Report
// ---------------------------------------------------------------------------
export async function generateUndertakingComplianceReport(
  user: AuthTokenPayload,
  filters: { region?: string; fromDate?: string; toDate?: string }
): Promise<ReportResult> {
  const allApps = await store.listApplications();
  const scopedApps = filterScopedApplications(allApps, user, filters.region);
  const appMap = new Map(scopedApps.map((a) => [a.id, a]));

  const allUts = await store.listUndertakings();
  const scopedUts = allUts.filter((u) => appMap.has(u.applicationId)).filter((u) =>
    matchesDateRange(u.createdAt, filters.fromDate, filters.toDate)
  );

  const now = new Date();
  const todayMs = now.getTime();

  let pending = 0;
  let submitted = 0;
  let verified = 0;
  let rejected = 0;
  let overdue = 0;

  const rows = await Promise.all(
    scopedUts.map(async (ut) => {
      const app = appMap.get(ut.applicationId)!;
      if (ut.status === 'PENDING') pending += 1;
      else if (ut.status === 'SUBMITTED') submitted += 1;
      else if (ut.status === 'VERIFIED') verified += 1;
      else if (ut.status === 'REJECTED') rejected += 1;
      else if (ut.status === 'OVERDUE') overdue += 1;

      const dueMs = new Date(ut.dueDate).getTime();
      const daysRemaining = Math.round((dueMs - todayMs) / (24 * 60 * 60 * 1000));

      const evidence = await store.getEvidence(ut.id);
      const verifications = await store.getVerifications(ut.id);
      const latestVerif = verifications.length > 0 ? verifications[verifications.length - 1] : undefined;

      return {
        undertakingId: ut.id,
        applicationId: ut.applicationId,
        institutionName: app.institutionName,
        region: app.region || 'ALL',
        conditionText: ut.conditionText,
        status: ut.status,
        dueDate: ut.dueDate.slice(0, 10),
        daysRemaining,
        evidenceCount: evidence.length,
        verifiedBy: latestVerif?.officer || '-',
        verifiedAt: latestVerif?.timestamp ? latestVerif.timestamp.slice(0, 10) : '-',
      };
    })
  );

  return {
    reportType: 'undertaking-compliance',
    title: 'Institutional Undertaking Compliance Report',
    generatedAt: now.toISOString(),
    filters,
    summary: {
      totalUndertakings: scopedUts.length,
      pending,
      submitted,
      verified,
      rejected,
      overdue,
    },
    columns: [
      { key: 'undertakingId', label: 'Undertaking ID' },
      { key: 'applicationId', label: 'Application ID' },
      { key: 'institutionName', label: 'Institution Name' },
      { key: 'region', label: 'Region' },
      { key: 'conditionText', label: 'Condition' },
      { key: 'status', label: 'Status' },
      { key: 'dueDate', label: 'Due Date' },
      { key: 'daysRemaining', label: 'Days Remaining', align: 'right' },
      { key: 'evidenceCount', label: 'Evidence Files', align: 'right' },
      { key: 'verifiedBy', label: 'Verified By' },
      { key: 'verifiedAt', label: 'Verified Date' },
    ],
    rows,
  };
}

// ---------------------------------------------------------------------------
// 4. Document Validity Report
// ---------------------------------------------------------------------------
export async function generateDocumentValidityReport(
  user: AuthTokenPayload,
  filters: { region?: string; fromDate?: string; toDate?: string }
): Promise<ReportResult> {
  const allApps = await store.listApplications();
  const scopedApps = filterScopedApplications(allApps, user, filters.region);
  const appMap = new Map(scopedApps.map((a) => [a.id, a]));

  const allDocs = await store.getComplianceDocuments();
  const scopedDocs = allDocs.filter((d) => appMap.has(d.applicationId)).filter((d) =>
    matchesDateRange(d.expiryDate, filters.fromDate, filters.toDate)
  );

  let valid = 0;
  let warning90 = 0;
  let warning60 = 0;
  let warning30 = 0;
  let overdue = 0;
  let renewalSubmitted = 0;

  const rows = scopedDocs.map((doc) => {
    const app = appMap.get(doc.applicationId)!;

    if (doc.state === 'VALID') valid += 1;
    else if (doc.state === 'OVERDUE') overdue += 1;
    else if (doc.state === 'WARNING') {
      if (doc.tier === 90) warning90 += 1;
      else if (doc.tier === 60) warning60 += 1;
      else warning30 += 1;
    }

    if (doc.renewalStatus === 'SUBMITTED') renewalSubmitted += 1;

    return {
      documentId: doc.id,
      applicationId: doc.applicationId,
      institutionName: app.institutionName,
      region: app.region || 'ALL',
      docType: doc.docType,
      expiryDate: doc.expiryDate,
      daysRemaining: doc.daysRemaining,
      expiryState: doc.state,
      warningTier: doc.tier ? `${doc.tier}d` : '-',
      renewalStatus: doc.renewalStatus || 'None',
      locked: app.locked ? 'Yes' : 'No',
    };
  });

  return {
    reportType: 'document-validity',
    title: 'Compliance Document Validity & Expiry Report',
    generatedAt: new Date().toISOString(),
    filters,
    summary: {
      totalDocuments: scopedDocs.length,
      valid,
      warningTier90: warning90,
      warningTier60: warning60,
      warningTier30: warning30,
      overdueExpired: overdue,
      renewalSubmitted,
    },
    columns: [
      { key: 'documentId', label: 'Document ID' },
      { key: 'applicationId', label: 'Application ID' },
      { key: 'institutionName', label: 'Institution Name' },
      { key: 'region', label: 'Region' },
      { key: 'docType', label: 'Document Type' },
      { key: 'expiryDate', label: 'Expiry Date' },
      { key: 'daysRemaining', label: 'Days Remaining', align: 'right' },
      { key: 'expiryState', label: 'State' },
      { key: 'warningTier', label: 'Warning Tier' },
      { key: 'renewalStatus', label: 'Renewal' },
      { key: 'locked', label: 'App Locked' },
    ],
    rows,
  };
}

// ---------------------------------------------------------------------------
// 5. Overdue Cases Report
// ---------------------------------------------------------------------------
export async function generateOverdueCasesReport(
  user: AuthTokenPayload,
  filters: { region?: string; fromDate?: string; toDate?: string }
): Promise<ReportResult> {
  const allApps = await store.listApplications();
  const scopedApps = filterScopedApplications(allApps, user, filters.region);
  const appMap = new Map(scopedApps.map((a) => [a.id, a]));

  const now = new Date();
  const nowDateStr = now.toISOString().slice(0, 10);
  const nowMs = now.getTime();

  let stageOverdue = 0;
  let undertakingOverdue = 0;
  let documentExpired = 0;
  let evcDelayed = 0;
  let escalatedCount = 0;

  const escalations = await store.listEscalations();
  const escMap = new Map<string, string>(); // key = appId:category -> highest level
  for (const esc of escalations) {
    escMap.set(`${esc.applicationId}:${esc.eventType}`, `Level ${esc.level}`);
  }

  interface OverdueRow {
    itemId: string;
    applicationId: string;
    institutionName: string;
    region: string;
    category: 'STAGE_SLA' | 'UNDERTAKING' | 'DOCUMENT_EXPIRY' | 'EVC_REPORT';
    itemDetail: string;
    dueDate: string;
    daysOverdue: number;
    escalationLevel: string;
    primaryActor: string;
  }

  const rows: OverdueRow[] = [];

  // A. Stage SLA Overdue
  for (const app of scopedApps) {
    if (app.status === 'APPROVED' || app.status === 'REJECTED') continue;
    if (app.slaDueAt && app.slaDueAt.slice(0, 10) < nowDateStr) {
      const dueMs = new Date(app.slaDueAt).getTime();
      const days = Math.max(1, Math.round((nowMs - dueMs) / (24 * 60 * 60 * 1000)));
      stageOverdue += 1;
      const escLvl = escMap.get(`${app.id}:PENDENCY`) || 'None';
      if (escLvl !== 'None') escalatedCount += 1;

      rows.push({
        itemId: `SLA-${app.id}`,
        applicationId: app.id,
        institutionName: app.institutionName,
        region: app.region || 'ALL',
        category: 'STAGE_SLA',
        itemDetail: `Application review SLA exceeded at stage ${app.status}`,
        dueDate: app.slaDueAt.slice(0, 10),
        daysOverdue: days,
        escalationLevel: escLvl,
        primaryActor: 'officer@aicte.gov.in',
      });
    }
  }

  // B. Undertakings Overdue
  const allUts = await store.listUndertakings();
  for (const ut of allUts) {
    if (!appMap.has(ut.applicationId)) continue;
    const app = appMap.get(ut.applicationId)!;
    if (ut.status === 'OVERDUE' || (ut.dueDate.slice(0, 10) < nowDateStr && ut.status !== 'VERIFIED')) {
      const dueMs = new Date(ut.dueDate).getTime();
      const days = Math.max(1, Math.round((nowMs - dueMs) / (24 * 60 * 60 * 1000)));
      undertakingOverdue += 1;
      const escLvl = escMap.get(`${app.id}:UNDERTAKING`) || 'None';
      if (escLvl !== 'None') escalatedCount += 1;

      rows.push({
        itemId: ut.id,
        applicationId: ut.applicationId,
        institutionName: app.institutionName,
        region: app.region || 'ALL',
        category: 'UNDERTAKING',
        itemDetail: ut.conditionText,
        dueDate: ut.dueDate.slice(0, 10),
        daysOverdue: days,
        escalationLevel: escLvl,
        primaryActor: 'institution',
      });
    }
  }

  // C. Compliance Documents Expired
  const allDocs = await store.getComplianceDocuments();
  for (const doc of allDocs) {
    if (!appMap.has(doc.applicationId)) continue;
    const app = appMap.get(doc.applicationId)!;
    if (doc.state === 'OVERDUE' || doc.expiryDate < nowDateStr) {
      const dueMs = new Date(doc.expiryDate).getTime();
      const days = Math.max(1, Math.round((nowMs - dueMs) / (24 * 60 * 60 * 1000)));
      documentExpired += 1;
      const escLvl = escMap.get(`${app.id}:DOCUMENT_EXPIRY`) || 'None';
      if (escLvl !== 'None') escalatedCount += 1;

      rows.push({
        itemId: doc.id,
        applicationId: doc.applicationId,
        institutionName: app.institutionName,
        region: app.region || 'ALL',
        category: 'DOCUMENT_EXPIRY',
        itemDetail: `Expired ${doc.docType} certificate`,
        dueDate: doc.expiryDate,
        daysOverdue: days,
        escalationLevel: escLvl,
        primaryActor: 'institution',
      });
    }
  }

  // D. EVC Inspections Delayed / Report overdue
  const inspections = await store.getInspections();
  for (const insp of inspections) {
    if (!appMap.has(insp.applicationId)) continue;
    const app = appMap.get(insp.applicationId)!;
    if (insp.reportDueAt && insp.reportDueAt < nowDateStr && !insp.report) {
      const dueMs = new Date(insp.reportDueAt).getTime();
      const days = Math.max(1, Math.round((nowMs - dueMs) / (24 * 60 * 60 * 1000)));
      evcDelayed += 1;
      const escLvl = escMap.get(`${app.id}:REPORT_SUBMISSION`) || 'None';
      if (escLvl !== 'None') escalatedCount += 1;

      rows.push({
        itemId: insp.id,
        applicationId: insp.applicationId,
        institutionName: app.institutionName,
        region: app.region || 'ALL',
        category: 'EVC_REPORT',
        itemDetail: 'Inspection completed but committee findings report is overdue',
        dueDate: insp.reportDueAt,
        daysOverdue: days,
        escalationLevel: escLvl,
        primaryActor: 'committee',
      });
    }
  }

  // Sort rows descending by days overdue
  rows.sort((a, b) => b.daysOverdue - a.daysOverdue);

  return {
    reportType: 'overdue-cases',
    title: 'Overdue Cases & Escalations Report',
    generatedAt: now.toISOString(),
    filters,
    summary: {
      totalOverdueItems: rows.length,
      stageSlaOverdue: stageOverdue,
      undertakingsOverdue: undertakingOverdue,
      documentsExpired: documentExpired,
      evcReportsDelayed: evcDelayed,
      escalationsActive: escalatedCount,
    },
    columns: [
      { key: 'itemId', label: 'Item ID' },
      { key: 'applicationId', label: 'Application ID' },
      { key: 'institutionName', label: 'Institution Name' },
      { key: 'region', label: 'Region' },
      { key: 'category', label: 'Category' },
      { key: 'itemDetail', label: 'Item Description' },
      { key: 'dueDate', label: 'Due Date' },
      { key: 'daysOverdue', label: 'Days Overdue', align: 'right' },
      { key: 'escalationLevel', label: 'Escalation Level' },
      { key: 'primaryActor', label: 'Responsible Role' },
    ],
    rows: rows as unknown as Record<string, unknown>[],
  };
}

// ---------------------------------------------------------------------------
// 6. Region-wise Processing Performance Report
// ---------------------------------------------------------------------------
export async function generateRegionPerformanceReport(
  user: AuthTokenPayload,
  filters: { fromDate?: string; toDate?: string; region?: string }
): Promise<ReportResult> {
  const allApps = await store.listApplications();
  const scopedApps = filterScopedApplications(allApps, user, filters.region).filter((app) =>
    matchesDateRange(app.createdAt, filters.fromDate, filters.toDate)
  );

  const now = new Date();
  const nowDateStr = now.toISOString().slice(0, 10);
  const nowMs = now.getTime();

  // Determine list of regions to report on
  const targetRegions =
    filters.region && filters.region !== 'ALL'
      ? [filters.region as Region]
      : user.role === 'OFFICER' && user.region && user.region !== 'ALL'
      ? [user.region]
      : ALL_REGIONS;

  const rows: Record<string, unknown>[] = [];
  let totalAppsCount = 0;
  let totalOverdueCount = 0;
  let totalReturnsCount = 0;
  let totalDaysAll = 0;
  let totalStageSamples = 0;

  for (const reg of targetRegions) {
    const regApps = scopedApps.filter((a) => a.region === reg);
    const count = regApps.length;

    let overdueCount = 0;
    let returnsCount = 0;
    let approvedCount = 0;
    let rejectedCount = 0;
    let inProgressCount = 0;
    let lockedCount = 0;
    let regDaysSum = 0;

    for (const app of regApps) {
      if (app.status === 'APPROVED') approvedCount += 1;
      else if (app.status === 'REJECTED') rejectedCount += 1;
      else inProgressCount += 1;

      if (app.locked) lockedCount += 1;

      // Returns count
      if (app.returns && app.returns.length > 0) {
        returnsCount += app.returns.length;
      }

      // Overdue check
      if (
        app.status !== 'APPROVED' &&
        app.status !== 'REJECTED' &&
        app.slaDueAt &&
        app.slaDueAt.slice(0, 10) < nowDateStr
      ) {
        overdueCount += 1;
      }

      // Days in stage calculation
      const createdMs = new Date(app.createdAt).getTime();
      const elapsedDays = Math.max(1, Math.round((nowMs - createdMs) / (24 * 60 * 60 * 1000)));
      regDaysSum += elapsedDays;
    }

    const overdueRate = count > 0 ? ((overdueCount / count) * 100).toFixed(1) + '%' : '0.0%';
    const avgDaysPerStage = count > 0 ? (regDaysSum / count).toFixed(1) : '0.0';

    totalAppsCount += count;
    totalOverdueCount += overdueCount;
    totalReturnsCount += returnsCount;
    totalDaysAll += regDaysSum;
    totalStageSamples += count;

    rows.push({
      region: reg,
      totalApplications: count,
      avgDaysPerStage,
      overdueRate,
      returnsCount,
      approvedCount,
      rejectedCount,
      inProgressCount,
      complianceLocked: lockedCount,
    });
  }

  const overallAvgDays =
    totalStageSamples > 0 ? (totalDaysAll / totalStageSamples).toFixed(1) : '0.0';
  const overallOverdueRate =
    totalAppsCount > 0 ? ((totalOverdueCount / totalAppsCount) * 100).toFixed(1) + '%' : '0.0%';

  return {
    reportType: 'region-performance',
    title: 'Region-Wise Processing Performance Report',
    generatedAt: now.toISOString(),
    filters,
    summary: {
      totalApplications: totalAppsCount,
      panIndiaAvgDaysPerStage: overallAvgDays,
      panIndiaOverdueRate: overallOverdueRate,
      totalReturnsAcrossRegions: totalReturnsCount,
    },
    columns: [
      { key: 'region', label: 'Region' },
      { key: 'totalApplications', label: 'Total Applications', align: 'right' },
      { key: 'avgDaysPerStage', label: 'Average Days / Stage', align: 'right' },
      { key: 'overdueRate', label: 'Overdue Rate', align: 'right' },
      { key: 'returnsCount', label: 'Returns Recorded', align: 'right' },
      { key: 'approvedCount', label: 'Approved', align: 'right' },
      { key: 'rejectedCount', label: 'Rejected', align: 'right' },
      { key: 'inProgressCount', label: 'In Progress', align: 'right' },
      { key: 'complianceLocked', label: 'Compliance Locked', align: 'right' },
    ],
    rows,
  };
}
