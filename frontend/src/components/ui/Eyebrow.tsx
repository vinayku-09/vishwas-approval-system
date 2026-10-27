import React from 'react';

interface EyebrowProps {
  children: React.ReactNode;
  className?: string;
}

export function Eyebrow({ children, className = '' }: EyebrowProps) {
  return (
    <span className={`text-xs font-semibold uppercase tracking-wider text-brand-600 ${className}`}>
      {children}
    </span>
  );
}
