import React from 'react';

interface StatCardProps {
  value: string;
  label: string;
  className?: string;
}

export function StatCard({ value, label, className = '' }: StatCardProps) {
  return (
    <div className={`text-center ${className}`}>
      <div className="text-3xl sm:text-4xl font-bold text-ink-900 mb-1">{value}</div>
      <div className="text-xs uppercase tracking-wider text-ink-400">{label}</div>
    </div>
  );
}
