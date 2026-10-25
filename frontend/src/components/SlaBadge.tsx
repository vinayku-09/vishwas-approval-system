import React from 'react';
import { calculateSla } from '../lib/utils';
import { Clock } from 'lucide-react';

interface SlaBadgeProps {
  createdAt: string;
  slaDueAt: string;
}

export function SlaBadge({ createdAt, slaDueAt }: SlaBadgeProps) {
  const sla = calculateSla(createdAt, slaDueAt);

  let iconColor = 'text-emerald-500';
  if (sla.status === 'WARNING') iconColor = 'text-amber-500';
  if (sla.status === 'OVERDUE') iconColor = 'text-red-500';

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-1.5">
        <span
          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border ${sla.color}`}
        >
          <Clock className={`w-3 h-3 ${iconColor}`} />
          {sla.label}
        </span>
        <span className="text-[11px] text-slate-500 font-mono">
          {sla.remainingDays > 0 ? `${sla.remainingDays}d left` : `${Math.abs(sla.remainingDays)}d overdue`}
        </span>
      </div>
      <div className="w-24 bg-slate-100 rounded-full h-1.5 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-300 ${
            sla.status === 'OVERDUE'
              ? 'bg-red-500'
              : sla.status === 'WARNING'
              ? 'bg-amber-500'
              : 'bg-emerald-500'
          }`}
          style={{ width: `${sla.elapsedPercent}%` }}
        />
      </div>
    </div>
  );
}
