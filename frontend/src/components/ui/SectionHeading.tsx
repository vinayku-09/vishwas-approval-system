import React from 'react';
import { Eyebrow } from './Eyebrow';

interface SectionHeadingProps {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  centered?: boolean;
  className?: string;
}

export function SectionHeading({ eyebrow, title, subtitle, centered = false, className = '' }: SectionHeadingProps) {
  return (
    <div className={`${centered ? 'text-center' : ''} mb-8 ${className}`}>
      {eyebrow && <Eyebrow className={centered ? 'block mb-2' : ''}>{eyebrow}</Eyebrow>}
      <h2 className={`text-2xl sm:text-3xl lg:text-4xl font-bold text-ink-900 tracking-tight leading-tight ${centered ? 'mx-auto' : ''}`}>
        {title}
      </h2>
      {subtitle && (
        <p className={`text-sm sm:text-base text-ink-600 mt-3 max-w-2xl ${centered ? 'mx-auto' : ''}`}>
          {subtitle}
        </p>
      )}
    </div>
  );
}
