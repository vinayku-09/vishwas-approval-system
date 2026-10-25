import { store } from '../db/store.js';
import {
  Affiliation,
  Application,
  InspectionAssignment,
  Inspector,
  OptimizationResult,
} from '../types.js';
import { runFallbackOptimizer } from './optimizerFallback.js';

export interface ScheduleOptions {
  startDate?: string;
  endDate?: string;
  applicationIds?: string[];
}

/**
 * Scheduling Service integrating OR-Tools optimizer service with built-in TypeScript fallback.
 */
export async function optimizeEvcSchedule(options: ScheduleOptions = {}): Promise<OptimizationResult> {
  const inspectors = await store.getInspectors();
  const affiliations = await store.getAffiliations();

  // Find target applications needing EVC inspection
  let applications = await store.listApplications({ status: 'EVC_REQUIRED' });
  if (options.applicationIds && options.applicationIds.length > 0) {
    const idSet = new Set(options.applicationIds);
    applications = applications.filter((app) => idSet.has(app.id));
  }

  // Filter only applications with coordinates and domain
  const institutionsToVisit = applications.map((app) => ({
    id: app.id,
    institutionName: app.institutionName,
    domain: app.domain || 'CSE',
    lat: app.lat || 19.076,
    lng: app.lng || 72.877,
  }));

  const allowedDateWindow =
    options.startDate && options.endDate
      ? { start: options.startDate, end: options.endDate }
      : undefined;

  // Real mode: check if OPTIMIZER_URL is configured
  const optimizerUrl = process.env.OPTIMIZER_URL;
  if (optimizerUrl) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);

      const res = await fetch(`${optimizerUrl}/api/optimize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          inspectors,
          institutions: institutionsToVisit,
          allowedDateWindow,
          conflictPairs: affiliations.map((a) => ({
            inspectorId: a.inspectorId,
            institutionName: a.institutionName,
            reason: a.reason,
          })),
          perVisitDurationHours: 4.0,
          workingHours: 9.0,
          travelSpeedKmH: 40.0,
        }),
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (res.ok) {
        const data = (await res.json()) as OptimizationResult;
        return {
          ...data,
          source: 'ortools',
        };
      }
      console.warn(`[Scheduler] OR-Tools service returned ${res.status}, falling back to built-in solver`);
    } catch (err) {
      console.warn('[Scheduler] OR-Tools service unreachable, falling back to built-in solver:', err);
    }
  }

  // Zero-setup Fallback: built-in TypeScript solver
  return runFallbackOptimizer({
    inspectors,
    institutions: institutionsToVisit,
    affiliations,
    allowedDateWindow,
    perVisitDurationHours: 4,
    workingHours: 9,
    travelSpeedKmH: 40,
  });
}

/**
 * Validates and creates an individual EVC inspection assignment.
 */
export async function scheduleSingleEvc(
  application: Application,
  inspectorIds: [string, string],
  scheduledDate: string,
  source: 'ortools' | 'fallback' | 'manual' = 'manual'
): Promise<{ success: boolean; error?: string; assignment?: InspectionAssignment }> {
  if (inspectorIds.length !== 2) {
    return { success: false, error: 'Inspection team must consist of exactly 2 inspectors' };
  }

  if (inspectorIds[0] === inspectorIds[1]) {
    return { success: false, error: 'Inspection team members must be two distinct individuals' };
  }

  const ins1 = await store.getInspector(inspectorIds[0]);
  const ins2 = await store.getInspector(inspectorIds[1]);

  if (!ins1 || !ins2) {
    return { success: false, error: 'One or more specified inspectors not found' };
  }

  const appDomain = application.domain || 'CSE';
  if (ins1.domain !== appDomain || ins2.domain !== appDomain) {
    return {
      success: false,
      error: `Domain mismatch: Application requires domain '${appDomain}', but inspectors have [${ins1.name}: ${ins1.domain}, ${ins2.name}: ${ins2.domain}]`,
    };
  }

  // Check affiliations / conflicts
  const affiliations = await store.getAffiliations();
  const instNameLower = application.institutionName.trim().toLowerCase();

  const conflict1 = affiliations.find(
    (a) => a.inspectorId === ins1.id && a.institutionName.trim().toLowerCase() === instNameLower
  );
  if (conflict1) {
    return {
      success: false,
      error: `Conflict of Interest: Inspector ${ins1.name} has active affiliation with ${application.institutionName} (${conflict1.reason})`,
    };
  }

  const conflict2 = affiliations.find(
    (a) => a.inspectorId === ins2.id && a.institutionName.trim().toLowerCase() === instNameLower
  );
  if (conflict2) {
    return {
      success: false,
      error: `Conflict of Interest: Inspector ${ins2.name} has active affiliation with ${application.institutionName} (${conflict2.reason})`,
    };
  }

  const assignment: InspectionAssignment = {
    id: `INSP-${application.id}`,
    applicationId: application.id,
    institutionName: application.institutionName,
    domain: appDomain,
    lat: application.lat || 19.076,
    lng: application.lng || 72.877,
    scheduledDate,
    inspectors: [
      { id: ins1.id, name: ins1.name, domain: ins1.domain, homeCity: ins1.homeCity },
      { id: ins2.id, name: ins2.name, domain: ins2.domain, homeCity: ins2.homeCity },
    ],
    status: 'SCHEDULED',
    source,
  };

  await store.saveInspection(assignment);
  return { success: true, assignment };
}
