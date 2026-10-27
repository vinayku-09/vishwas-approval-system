import React from 'react';

interface TerminalCardProps {
  children: React.ReactNode;
  className?: string;
  title?: string;
}

export function TerminalCard({ children, className = '', title = 'sample output' }: TerminalCardProps) {
  return (
    <div className={`bg-[#0F172A] rounded-2xl border border-slate-700 overflow-hidden ${className}`}>
      <div className="bg-[#1E293B] px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-red-500"></div>
          <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
          <div className="w-3 h-3 rounded-full bg-green-500"></div>
        </div>
        <span className="text-xs text-slate-400 font-mono">{title}</span>
      </div>
      <div className="p-4 font-mono text-xs text-green-400 space-y-1">
        {children}
      </div>
    </div>
  );
}
