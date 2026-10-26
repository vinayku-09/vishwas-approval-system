import React from 'react';
import { Check, ChevronRight } from 'lucide-react';
import { RouteState } from '../lib/types';
import { STATUS_LABELS } from '../lib/utils';

interface RouteSequenceProps {
  route?: RouteState | null;
  compact?: boolean;
}

export function RouteSequence({ route, compact = false }: RouteSequenceProps) {
  if (!route) return null;

  const currentIndex = Math.max(
    0,
    route.stages.findIndex((stage) => stage === route.currentStage)
  );

  return (
    <div
      className={`rounded-xl border border-slate-200 bg-slate-50 ${
        compact ? 'p-3' : 'p-4'
      }`}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Configured approval route
          </p>
          <p className="text-xs font-bold text-slate-900 mt-0.5">{route.name}</p>
        </div>
        <span className="font-mono text-[10px] font-bold text-gov-blue-800 bg-blue-50 border border-blue-200 rounded px-1.5 py-0.5">
          {route.id}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-1.5 mt-3">
        {route.stages.map((stage, index) => {
          const isCurrent = index === currentIndex;
          const isComplete = index < currentIndex;
          return (
            <React.Fragment key={`${stage}-${index}`}>
              <span
                title={STATUS_LABELS[stage]?.title ?? stage}
                className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[10px] font-bold ${
                  isCurrent
                    ? 'bg-gov-blue-900 text-white border-gov-blue-900'
                    : isComplete
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                    : 'bg-white text-slate-500 border-slate-200'
                }`}
              >
                {isComplete ? (
                  <Check className="w-3 h-3" />
                ) : (
                  <span className={isCurrent ? 'text-blue-100' : 'text-slate-400'}>
                    {index + 1}
                  </span>
                )}
                <span>{stage}</span>
              </span>
              {index < route.stages.length - 1 && (
                <ChevronRight className="w-3 h-3 text-slate-300 flex-shrink-0" />
              )}
            </React.Fragment>
          );
        })}
      </div>

      {!compact && (
        <p className="text-[10px] text-slate-500 mt-2 leading-relaxed">
          {route.description} Placeholder pending APH; this is not an official AICTE rule.
        </p>
      )}
    </div>
  );
}
