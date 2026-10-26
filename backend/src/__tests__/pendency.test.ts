import { describe, it, expect } from 'vitest';
import {
  APPROACHING_DAYS_LEFT,
  APPROACHING_THRESHOLD_FRACTION,
  computePendency,
  getAgeingBucket,
  getAllRouteStages,
  getRouteTotalDays,
  ROUTE_STAGE_DAYS,
} from '../config/sla-config.js';
import { APPROVAL_ROUTES } from '../config/routes.js';

describe('Part 3: SLA config and pendency', () => {
  it('derives stage names from the four PS routes without retyping them', () => {
    const stages = getAllRouteStages();
    for (const route of Object.values(APPROVAL_ROUTES)) {
      for (const stage of route.stages) {
        expect(stages).toContain(stage);
      }
    }
    for (const [routeId, overrides] of Object.entries(ROUTE_STAGE_DAYS)) {
      const routeStages = APPROVAL_ROUTES[routeId as keyof typeof APPROVAL_ROUTES].stages;
      for (const stage of Object.keys(overrides)) {
        expect(routeStages).toContain(stage);
      }
    }
  });

  it('classifies ageing buckets at the configured edges', () => {
    expect(getAgeingBucket(0)).toBe('0-3');
    expect(getAgeingBucket(3)).toBe('0-3');
    expect(getAgeingBucket(4)).toBe('4-7');
    expect(getAgeingBucket(7)).toBe('4-7');
    expect(getAgeingBucket(8)).toBe('8-14');
    expect(getAgeingBucket(14)).toBe('8-14');
    expect(getAgeingBucket(15)).toBe('15-30');
    expect(getAgeingBucket(30)).toBe('15-30');
    expect(getAgeingBucket(31)).toBe('>30');
  });

  it('asserts On time / Approaching / Overdue at SLA day boundaries', () => {
    const created = '2026-01-01T00:00:00Z';
    const start = Date.parse(created);
    const dayMs = 24 * 60 * 60 * 1000;
    const total = getRouteTotalDays('ONLY_SCRUTINY');

    const atDays = (days: number) =>
      computePendency(created, new Date(start + days * dayMs), 'ONLY_SCRUTINY', 'SUBMITTED');

    const beforeThreshold = atDays(total - APPROACHING_DAYS_LEFT - 1);
    expect(beforeThreshold.ageDays / Math.max(1, total)).toBeLessThanOrEqual(
      APPROACHING_THRESHOLD_FRACTION
    );
    expect(beforeThreshold.status).toBe('On time');

    const atThreshold = atDays(total - APPROACHING_DAYS_LEFT);
    expect(atThreshold.status).toBe('Approaching');

    const afterThreshold = atDays(total - APPROACHING_DAYS_LEFT + 1);
    expect(afterThreshold.status).toBe('Approaching');

    const onDueDate = atDays(total);
    expect(onDueDate.daysLeft).toBe(0);
    expect(onDueDate.status).toBe('Approaching');

    const afterDue = atDays(total + 1);
    expect(afterDue.status).toBe('Overdue');
  });
});
