'use client';

import React, { useEffect, useState } from 'react';
import { AlertCircle } from 'lucide-react';
import { isDemoModeActive, subscribeDemoMode } from '../lib/api';

export function DemoBanner() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    setShow(isDemoModeActive());
    return subscribeDemoMode(setShow);
  }, []);

  if (!show) return null;

  return (
    <div className="bg-amber-500/10 border-b border-amber-500/20 text-amber-900 px-4 py-2 text-xs md:text-sm font-medium flex items-center justify-between">
      <div className="max-w-7xl mx-auto w-full flex items-center gap-2">
        <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0" />
        <span>
          <strong>Demo Mode:</strong> Running in demonstration mode with sample data.
        </span>
      </div>
    </div>
  );
}
