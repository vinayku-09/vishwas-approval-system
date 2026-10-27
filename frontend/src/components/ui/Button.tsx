import React from 'react';
import { ArrowRight } from 'lucide-react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  children: React.ReactNode;
  showArrow?: boolean;
}

export function Button({ 
  variant = 'primary', 
  size = 'md', 
  children, 
  showArrow = false,
  className = '',
  ...props 
}: ButtonProps) {
  const baseStyles = 'inline-flex items-center justify-center gap-2 font-medium transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed';
  
  const variants = {
    primary: 'bg-brand-600 hover:bg-brand-700 text-white rounded-lg shadow-sm',
    secondary: 'bg-white hover:bg-canvas text-ink-900 border border-line rounded-lg',
    ghost: 'text-ink-600 hover:text-ink-900 hover:bg-canvas rounded-lg',
  };
  
  const sizes = {
    sm: 'px-3 py-1.5 text-xs',
    md: 'px-4 py-2 text-sm',
    lg: 'px-6 py-2.5 text-sm',
  };
  
  return (
    <button
      className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${className}`}
      {...props}
    >
      {children}
      {showArrow && <ArrowRight className="w-4 h-4" />}
    </button>
  );
}
