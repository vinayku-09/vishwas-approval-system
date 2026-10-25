'use client';

import React from 'react';
import { AlertCircle } from 'lucide-react';

interface DemoBannerProps {
  show: boolean;
}

export function DemoBanner({ show }: DemoBannerProps) {
  if (!show) return null;

  return (
    <div className="bg-amber-500/10 border-b border-amber-500/20 text-amber-900 px-4 py-2 text-xs md:text-sm font-medium flex items-center justify-between">
      <div className="max-w-7xl mx-auto w-full flex items-center gap-2">
        <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0" />
        <span>
          <strong>Demo Mode:</strong> Backend server offline or unreachable (port 4000). Falling back to local in-memory simulation with seed records.
        </span>
      </div>
    </div>
  );
}
