import React from 'react';
import { Deficiency } from '../lib/types';
import { AlertTriangle, CheckCircle2 } from 'lucide-react';

interface DeficiencyListProps {
  deficiencies: Deficiency[];
}

export function DeficiencyList({ deficiencies }: DeficiencyListProps) {
  if (!deficiencies || deficiencies.length === 0) {
    return (
      <div className="flex items-center gap-2 p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-800 text-sm">
        <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
        <div>
          <span className="font-semibold">Zero Deficiencies Found</span>
          <p className="text-xs text-emerald-700">All evaluated AICTE regulatory norms are fully satisfied.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2.5">
      <div className="flex items-center gap-2 text-red-800 font-semibold text-xs tracking-wider uppercase">
        <AlertTriangle className="w-4 h-4 text-red-600" />
        Deficiency Report ({deficiencies.length} Issues Flagged)
      </div>
      <div className="space-y-2">
        {deficiencies.map((d, idx) => (
          <div
            key={idx}
            className="p-3 bg-red-50/70 border border-red-200 rounded-lg text-sm text-red-900 flex flex-col gap-1"
          >
            <div className="flex items-center justify-between">
              <span className="font-semibold text-xs text-red-700 bg-red-100 px-2 py-0.5 rounded">
                {d.clause}
              </span>
              <span
                className={`text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded ${
                  d.severity === 'CRITICAL'
                    ? 'bg-red-600 text-white'
                    : 'bg-amber-500 text-white'
                }`}
              >
                {d.severity}
              </span>
            </div>
            <p className="text-xs text-slate-800 mt-1 leading-relaxed">{d.message}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
