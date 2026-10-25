import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { SlaInfo, Status } from './types';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(isoString: string): string {
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return isoString;
    return new Intl.DateTimeFormat('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(d);
  } catch {
    return isoString;
  }
}

export function shortHash(hash: string, chars = 6): string {
  if (!hash) return '';
  if (hash.length <= chars * 2) return hash;
  return `${hash.slice(0, chars)}...${hash.slice(-chars)}`;
}

export function calculateSla(createdAt: string, slaDueAt: string): SlaInfo {
  const start = new Date(createdAt).getTime();
  const due = new Date(slaDueAt).getTime();
  const now = Date.now();

  const total = Math.max(1, due - start);
  const elapsed = Math.max(0, now - start);
  const ratio = elapsed / total;
  const elapsedPercent = Math.min(100, Math.round(ratio * 100));

  const remainingDays = Math.ceil((due - now) / (1000 * 60 * 60 * 24));

  if (now > due) {
    return {
      status: 'OVERDUE',
      label: 'Overdue',
      color: 'text-red-700 bg-red-50 border-red-200',
      remainingDays,
      elapsedPercent: 100,
    };
  }

  if (ratio > 0.8) {
    return {
      status: 'WARNING',
      label: 'Warning',
      color: 'text-amber-800 bg-amber-50 border-amber-200',
      remainingDays,
      elapsedPercent,
    };
  }

  return {
    status: 'ON_TIME',
    label: 'On time',
    color: 'text-emerald-700 bg-emerald-50 border-emerald-200',
    remainingDays,
    elapsedPercent,
  };
}

export const STATUS_LABELS: Record<Status, { title: string; color: string; bg: string; border: string }> = {
  SUBMITTED: {
    title: 'Submitted',
    color: 'text-blue-700',
    bg: 'bg-blue-50',
    border: 'border-blue-200',
  },
  SCRUTINY: {
    title: 'AI Scrutiny',
    color: 'text-indigo-700',
    bg: 'bg-indigo-50',
    border: 'border-indigo-200',
  },
  DEFICIENT: {
    title: 'Deficient',
    color: 'text-red-700',
    bg: 'bg-red-50',
    border: 'border-red-200',
  },
  EVC_REQUIRED: {
    title: 'EVC Inspection Required',
    color: 'text-amber-800',
    bg: 'bg-amber-50',
    border: 'border-amber-200',
  },
  EVC_DONE: {
    title: 'EVC Completed',
    color: 'text-purple-700',
    bg: 'bg-purple-50',
    border: 'border-purple-200',
  },
  DECISION: {
    title: 'Executive Decision',
    color: 'text-sky-700',
    bg: 'bg-sky-50',
    border: 'border-sky-200',
  },
  APPROVED: {
    title: 'Approved',
    color: 'text-emerald-700',
    bg: 'bg-emerald-50',
    border: 'border-emerald-200',
  },
  REJECTED: {
    title: 'Rejected',
    color: 'text-rose-700',
    bg: 'bg-rose-50',
    border: 'border-rose-200',
  },
  APPEAL_SHC: {
    title: 'Appeal (Hearing Comm.)',
    color: 'text-orange-700',
    bg: 'bg-orange-50',
    border: 'border-orange-200',
  },
  APPEAL_SAC: {
    title: 'Appeal (Appellate Comm.)',
    color: 'text-stone-700',
    bg: 'bg-stone-50',
    border: 'border-stone-200',
  },
};
