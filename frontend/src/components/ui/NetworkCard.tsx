import React from 'react';

interface NetworkCardProps {
  color: 'green' | 'indigo' | 'teal';
  title: string;
  children: React.ReactNode;
  className?: string;
}

export function NetworkCard({ color, title, children, className = '' }: NetworkCardProps) {
  const colorStyles = {
    green: 'bg-success',
    indigo: 'bg-info',
    teal: 'bg-teal',
  };
  
  return (
    <div className={`relative rounded-3xl ${colorStyles[color]} p-6 overflow-hidden ${className}`}>
      <svg className="absolute inset-0 w-full h-full opacity-20" viewBox="0 0 400 200" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <pattern id="dots" x="0" y="0" width="20" height="20" patternUnits="userSpaceOnUse">
            <circle cx="2" cy="2" r="1" fill="white" />
          </pattern>
        </defs>
        <rect width="400" height="200" fill="url(#dots)" />
        <line x1="50" y1="50" x2="150" y2="80" stroke="white" strokeWidth="1" opacity="0.5" />
        <line x1="150" y1="80" x2="250" y2="60" stroke="white" strokeWidth="1" opacity="0.5" />
        <line x1="250" y1="60" x2="350" y2="100" stroke="white" strokeWidth="1" opacity="0.5" />
        <circle cx="50" cy="50" r="3" fill="white" opacity="0.8" />
        <circle cx="150" cy="80" r="3" fill="white" opacity="0.8" />
        <circle cx="250" cy="60" r="3" fill="white" opacity="0.8" />
        <circle cx="350" cy="100" r="3" fill="white" opacity="0.8" />
      </svg>
      <div className="relative z-10">
        <h3 className="text-white text-lg font-bold mb-2">{title}</h3>
        <div className="text-white/90 text-sm">{children}</div>
      </div>
    </div>
  );
}
