import React from 'react';
import { Status } from '../lib/types';
import { STATUS_LABELS } from '../lib/utils';

interface StatusBadgeProps {
  status: Status;
  size?: 'sm' | 'md';
}

export function StatusBadge({ status, size = 'md' }: StatusBadgeProps) {
  const config = STATUS_LABELS[status] || {
    title: status,
    color: 'text-slate-700',
    bg: 'bg-slate-50',
    border: 'border-slate-200',
  };

  const sizeClasses =
    size === 'sm' ? 'px-2 py-0.5 text-xs font-semibold' : 'px-2.5 py-1 text-xs font-bold';

  return (
    <span
      className={`inline-flex items-center rounded-md border ${config.bg} ${config.color} ${config.border} ${sizeClasses} tracking-wide shadow-sm`}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-current mr-1.5 opacity-80" />
      {config.title}
    </span>
  );
}
