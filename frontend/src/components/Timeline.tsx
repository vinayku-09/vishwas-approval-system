import React from 'react';
import { Status } from '../lib/types';
import { Check, Clock, AlertCircle } from 'lucide-react';

interface TimelineProps {
  currentStatus: Status;
}

interface Step {
  id: string;
  label: string;
  description: string;
  statuses: Status[];
}

const STEPS: Step[] = [
  {
    id: 'submission',
    label: '1. Submission',
    description: 'Mandatory documentation & land deeds uploaded',
    statuses: ['SUBMITTED'],
  },
  {
    id: 'scrutiny',
    label: '2. AI Scrutiny',
    description: 'Norms validation & deficiency analysis',
    statuses: ['SCRUTINY', 'DEFICIENT'],
  },
  {
    id: 'evc',
    label: '3. Committee Visit',
    description: 'Expert Visit Committee campus verification',
    statuses: ['EVC_REQUIRED', 'EVC_DONE'],
  },
  {
    id: 'decision',
    label: '4. Executive Decision',
    description: 'Regional committee review & order preparation',
    statuses: ['DECISION'],
  },
  {
    id: 'outcome',
    label: '5. Outcome & Appeal',
    description: 'Final approval or Standing Appellate hearing',
    statuses: ['APPROVED', 'REJECTED', 'APPEAL_SHC', 'APPEAL_SAC'],
  },
];

export function Timeline({ currentStatus }: TimelineProps) {
  // Find which step index is active
  const activeStepIdx = STEPS.findIndex((step) => step.statuses.includes(currentStatus));

  return (
    <div className="w-full py-2">
      <div className="relative flex flex-col md:flex-row justify-between items-start md:items-center gap-4 md:gap-0">
        {/* Horizontal connector line on desktop */}
        <div className="hidden md:block absolute top-4 left-6 right-6 h-0.5 bg-slate-200 -z-0" />

        {STEPS.map((step, idx) => {
          const isCompleted = activeStepIdx > idx || currentStatus === 'APPROVED';
          const isCurrent = activeStepIdx === idx;
          const isDeficient = currentStatus === 'DEFICIENT' && step.id === 'scrutiny';
          const isRejected = currentStatus === 'REJECTED' && step.id === 'outcome';

          return (
            <div
              key={step.id}
              className="relative z-10 flex md:flex-col items-center md:items-center text-left md:text-center w-full md:w-44 gap-3 md:gap-2"
            >
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs transition-colors flex-shrink-0 ${
                  isDeficient
                    ? 'bg-red-600 text-white ring-4 ring-red-100'
                    : isRejected
                    ? 'bg-rose-600 text-white ring-4 ring-rose-100'
                    : isCompleted
                    ? 'bg-emerald-600 text-white ring-4 ring-emerald-100'
                    : isCurrent
                    ? 'bg-gov-blue-800 text-white ring-4 ring-blue-100 shadow-md'
                    : 'bg-white border-2 border-slate-300 text-slate-400'
                }`}
              >
                {isDeficient ? (
                  <AlertCircle className="w-4 h-4" />
                ) : isCompleted ? (
                  <Check className="w-4 h-4 stroke-[3]" />
                ) : isCurrent ? (
                  <Clock className="w-4 h-4" />
                ) : (
                  <span>{idx + 1}</span>
                )}
              </div>
              <div>
                <p
                  className={`text-xs font-semibold ${
                    isCurrent ? 'text-gov-blue-900 font-bold' : isCompleted ? 'text-slate-800' : 'text-slate-400'
                  }`}
                >
                  {step.label}
                </p>
                <p className="text-[11px] text-slate-500 leading-tight hidden md:block mt-0.5">
                  {step.description}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
