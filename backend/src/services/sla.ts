import { SlaInfo } from '../types.js';
import { SLA_WARNING_THRESHOLD } from '../config/timelines.js';

/**
 * Derives SLA compliance status based on creation timestamp and due deadline.
 * - On time: <= 80% of window elapsed
 * - Warning: > 80% of window elapsed but not yet past due date
 * - Overdue: current time exceeds slaDueAt
 */
export function calculateSla(createdAt: string, slaDueAt: string, currentDate = new Date()): SlaInfo {
  const start = new Date(createdAt).getTime();
  const due = new Date(slaDueAt).getTime();
  const now = currentDate.getTime();

  const totalDuration = Math.max(1, due - start);
  const elapsed = Math.max(0, now - start);
  const elapsedRatio = elapsed / totalDuration;
  const elapsedPercent = Math.min(100, Math.round(elapsedRatio * 100));

  const remainingMs = due - now;
  const remainingDays = Math.ceil(remainingMs / (1000 * 60 * 60 * 24));

  if (now > due) {
    return {
      status: 'OVERDUE',
      label: 'Overdue',
      color: 'red',
      remainingDays,
      elapsedPercent: 100,
    };
  }

  if (elapsedRatio > SLA_WARNING_THRESHOLD) {
    return {
      status: 'WARNING',
      label: 'Warning',
      color: 'amber',
      remainingDays,
      elapsedPercent,
    };
  }

  return {
    status: 'ON_TIME',
    label: 'On time',
    color: 'emerald',
    remainingDays,
    elapsedPercent,
  };
}
