import React from 'react';

interface DarkSectionProps {
  children: React.ReactNode;
  className?: string;
}

export function DarkSection({ children, className = '' }: DarkSectionProps) {
  return (
    <section className={`w-full bg-[#0B1220] py-16 px-4 sm:px-6 lg:px-8 ${className}`}>
      <div className="max-w-7xl mx-auto">
        {children}
      </div>
    </section>
  );
}
