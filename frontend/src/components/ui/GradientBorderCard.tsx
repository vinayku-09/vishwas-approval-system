import React from 'react';

interface GradientBorderCardProps {
  children: React.ReactNode;
  className?: string;
}

export function GradientBorderCard({ children, className = '' }: GradientBorderCardProps) {
  return (
    <div className={`relative p-[1px] rounded-2xl bg-gradient-to-r from-pink-500 via-violet-500 to-blue-500 shadow-float ${className}`}>
      <div className="bg-white rounded-2xl h-full w-full">
        {children}
      </div>
    </div>
  );
}
