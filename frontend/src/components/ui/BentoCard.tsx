import React from 'react';

interface BentoCardProps {
  icon?: React.ReactNode;
  title: string;
  description: string;
  className?: string;
}

export function BentoCard({ icon, title, description, className = '' }: BentoCardProps) {
  return (
    <div className={`bg-white rounded-2xl border border-line p-6 shadow-soft hover:shadow-float transition-shadow duration-150 ${className}`}>
      {icon && (
        <div className="w-10 h-10 rounded-lg bg-brand-50 flex items-center justify-center mb-4">
          {icon}
        </div>
      )}
      <h3 className="text-base font-semibold text-ink-900 mb-2">{title}</h3>
      <p className="text-sm text-ink-600 leading-relaxed">{description}</p>
    </div>
  );
}
