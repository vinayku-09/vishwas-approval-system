/**
 * reports.ts - Routes for the six AICTE reports with CSV export and role scoping.
 */

import { Hono } from 'hono';
import { authMiddleware } from '../middleware/auth.js';
import {
  generateApplicationPendencyReport,
  generateEvcStatusReport,
  generateUndertakingComplianceReport,
  generateDocumentValidityReport,
  generateOverdueCasesReport,
  generateRegionPerformanceReport,
  reportToCsv,
  type ReportResult,
  type ReportType,
} from '../services/reports.js';

import { store } from '../db/store.js';
import { Region } from '../types.js';

export const reportsRouter = new Hono();

reportsRouter.use('*', authMiddleware);

const REPORT_GENERATORS: Record<
  ReportType,
  (user: any, filters: any) => Promise<ReportResult>
> = {
  'application-pendency': generateApplicationPendencyReport,
  'evc-status': generateEvcStatusReport,
  'undertaking-compliance': generateUndertakingComplianceReport,
  'document-validity': generateDocumentValidityReport,
  'overdue-cases': generateOverdueCasesReport,
  'region-performance': generateRegionPerformanceReport,
};

// GET /reports - list available reports
reportsRouter.get('/', (c) => {
  return c.json({
    reports: [
      {
        id: 'application-pendency',
        title: 'Application Pendency Report',
        description:
          'Track applications across routes, stages, age in days, and On time / Approaching / Overdue SLA status.',
      },
      {
        id: 'evc-status',
        title: 'EVC Status Report',
        description:
          'Monitor Expert Visit Committee inspections: awaiting scheduling, scheduled, completed, and delayed inspections.',
      },
      {
        id: 'undertaking-compliance',
        title: 'Undertaking Compliance Report',
        description:
          'Review institutional commitments: pending, submitted evidence, verified, rejected, and overdue compliance items.',
      },
      {
        id: 'document-validity',
        title: 'Document Validity & Expiry Report',
        description:
          'Monitor compliance documents across warning tiers (90, 60, 30 days) and expired items causing application locks.',
      },
      {
        id: 'overdue-cases',
        title: 'Overdue Cases & Escalations Report',
        description:
          'Comprehensive log of overdue applications, undertakings, expired documents, delayed EVCs, and active escalations.',
      },
      {
        id: 'region-performance',
        title: 'Region-Wise Processing Performance Report',
        description:
          'Analyze regional performance: average days per stage, overdue rate percentage, return frequency, and approval rates.',
      },
    ],
  });
});

// GET /reports/irregularity-analytics - Head Office (CHIEF) exclusive irregularity analytics
reportsRouter.get('/irregularity-analytics', async (c) => {
  const user = c.get('user');
  if (user.role !== 'CHIEF') {
    return c.json({ error: 'Forbidden: Admin analytics is restricted to AICTE Head Office (CHIEF)' }, 403);
  }

  const fromDate = c.req.query('fromDate');
  const toDate = c.req.query('toDate');
  const metricFilter = c.req.query('metric') || 'all';

  const [applications, escalations, complianceDocs] = await Promise.all([
    store.listApplications(),
    store.listEscalations(),
    store.getComplianceDocuments(),
  ]);

  const REGIONS: Region[] = ['NORTH', 'SOUTH', 'EAST', 'WEST', 'CENTRAL', 'NORTH_EAST'];
  const now = new Date();

  // Helper date filter
  const filterByDate = (dStr?: string) => {
    if (!dStr) return true;
    const d = dStr.slice(0, 10);
    if (fromDate && d < fromDate) return false;
    if (toDate && d > toDate) return false;
    return true;
  };

  const filteredApps = applications.filter((app) => filterByDate(app.createdAt));

  // Build region stats
  const regionStats = REGIONS.map((region) => {
    const regionApps = filteredApps.filter((app) => (app.region || 'NORTH') === region);

    let returnsCount = 0;
    let rejectionsCount = 0;
    let overdueCount = 0;
    const regionEscalations = escalations.filter(
      (e) => e.region === region && (e.status === 'OPEN' || e.status === 'ACKNOWLEDGED')
    );
    const escalatedAlertsCount = regionEscalations.length;
    let authenticityRiskCount = 0;

    const detailedApps = regionApps.map((app) => {
      const appReturns = app.returns?.length || (app.lastReturn ? 1 : 0);
      returnsCount += appReturns;

      const isRejected = app.status === 'REJECTED';
      if (isRejected) rejectionsCount += 1;

      const isOverdue =
        !['APPROVED', 'REJECTED'].includes(app.status) &&
        app.slaDueAt &&
        new Date(app.slaDueAt) < now;
      if (isOverdue) overdueCount += 1;

      const appDocs = complianceDocs.filter((d) => d.applicationId === app.id);
      const hasAuthRisk =
        appDocs.some((d) => d.authenticityDueAt && new Date(d.authenticityDueAt) < now) ||
        appDocs.some((d) => d.state === 'OVERDUE');
      if (hasAuthRisk) authenticityRiskCount += 1;

      const appEscalations = escalations.filter(
        (e) => e.applicationId === app.id && (e.status === 'OPEN' || e.status === 'ACKNOWLEDGED')
      ).length;

      const itemScore =
        appReturns +
        (isRejected ? 1 : 0) +
        (isOverdue ? 1 : 0) +
        appEscalations +
        (hasAuthRisk ? 1 : 0);

      return {
        id: app.id,
        institutionName: app.institutionName,
        status: app.status,
        type: app.type,
        region: app.region || region,
        createdAt: app.createdAt,
        returns: appReturns,
        isRejected,
        isOverdue: !!isOverdue,
        escalatedAlerts: appEscalations,
        authenticityRisk: hasAuthRisk,
        irregularityScore: itemScore,
      };
    });

    const irregularityScore =
      returnsCount +
      rejectionsCount +
      overdueCount +
      escalatedAlertsCount +
      authenticityRiskCount;

    return {
      region,
      irregularityScore,
      metrics: {
        returns: returnsCount,
        rejections: rejectionsCount,
        overdue: overdueCount,
        escalatedAlerts: escalatedAlertsCount,
        authenticityRiskFlags: authenticityRiskCount,
      },
      applications: detailedApps,
    };
  });

  // Calculate monthly time-series trend (past 6 months)
  const months: string[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    months.push(d.toISOString().slice(0, 7)); // YYYY-MM
  }

  const timeSeries = months.map((month) => {
    const entry: Record<string, unknown> = { period: month };
    REGIONS.forEach((r) => {
      const rApps = filteredApps.filter(
        (a) => (a.region || 'NORTH') === r && a.createdAt && a.createdAt.slice(0, 7) === month
      );
      const score = rApps.reduce(
        (acc, a) =>
          acc + (a.returns?.length || (a.lastReturn ? 1 : 0)) + (a.status === 'REJECTED' ? 1 : 0),
        0
      );
      entry[r] = score;
    });
    return entry;
  });

  return c.json({
    formula:
      'irregularity = returns + rejections + overdue + escalated alerts + authenticity-risk flags',
    filters: { fromDate, toDate, metric: metricFilter },
    regions: regionStats,
    timeSeries,
    generatedAt: new Date().toISOString(),
  });
});

// GET /reports/:type - generate a specific report
reportsRouter.get('/:type', async (c) => {
  const user = c.get('user');
  const type = c.req.param('type') as ReportType;

  const generator = REPORT_GENERATORS[type];
  if (!generator) {
    return c.json(
      {
        error: `Unknown report type '${type}'. Valid types are: ${Object.keys(REPORT_GENERATORS).join(', ')}`,
      },
      404
    );
  }

  // Institution restriction for region performance
  if (type === 'region-performance' && user.role === 'INSTITUTION') {
    return c.json(
      {
        error: 'Forbidden: Regional processing performance analytics is restricted to AICTE officers and Head Office.',
      },
      403
    );
  }

  const region = c.req.query('region') || undefined;
  const fromDate = c.req.query('fromDate') || undefined;
  const toDate = c.req.query('toDate') || undefined;
  const format = c.req.query('format')?.toLowerCase();
  const acceptHeader = c.req.header('Accept') || '';

  try {
    const report = await generator(user, { region, fromDate, toDate });

    // CSV format requested via query param or Accept header
    if (format === 'csv' || acceptHeader.includes('text/csv')) {
      const csv = reportToCsv(report);
      const filename = `report-${type}-${new Date().toISOString().slice(0, 10)}.csv`;

      return c.text(csv, 200, {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
      });
    }

    return c.json(report);
  } catch (err) {
    console.error(`Error generating report ${type}:`, err);
    return c.json({ error: `Failed to generate report '${type}'` }, 500);
  }
});

export default reportsRouter;
