import React from 'react';
import { ShieldAlert } from 'lucide-react';

interface SafeguardNoticeProps {
  className?: string;
  compact?: boolean;
}

/**
 * Universal notice shown on decision screens. Automated checks are assistive;
 * every rejection, return, override or closure remains a human decision.
 */
export function SafeguardNotice({ className = '', compact = false }: SafeguardNoticeProps) {
  return (
    <div
      className={`rounded-xl border border-amber-300 bg-amber-50 text-amber-950 ${
        compact ? 'p-3' : 'p-4'
      } ${className}`}
      role="note"
    >
      <div className="flex items-start gap-2.5">
        <ShieldAlert className="w-4 h-4 text-amber-700 flex-shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="text-[11px] font-extrabold uppercase tracking-wider text-amber-900">
            Human decision safeguard
          </p>
          <p className="text-[11px] leading-relaxed">
            Automated checks assist the competent authority; they do not decide the case. Every
            rejection, return, override or closure requires a human sign-off with a recorded reason
            and is written to the audit ledger. Route and stage settings are placeholders pending the
            AICTE Approval Process Handbook.
          </p>
        </div>
      </div>
    </div>
  );
}
