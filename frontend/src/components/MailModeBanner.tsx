'use client';

import React, { useEffect, useState } from 'react';
import { Mail } from 'lucide-react';
import { getHealth } from '../lib/api';

export function MailModeBanner() {
  const [mode, setMode] = useState<string | null>(null);

  useEffect(() => {
    getHealth().then((res) => {
      if (res.data?.mail) {
        setMode(res.data.mail.mode);
      }
    });
  }, []);

  if (!mode || mode === 'live') return null;

  return (
    <div className="bg-sky-50 border-b border-sky-200 text-sky-900 px-4 py-2 text-xs md:text-sm font-medium">
      <div className="max-w-7xl mx-auto flex items-center gap-2">
        <Mail className="w-4 h-4 text-sky-600 flex-shrink-0" />
        <span>
          <strong>Demo mail mode:</strong> alert emails are being {mode === 'log' ? 'printed to the server log' : 'sent to an Ethereal test inbox'} instead of real recipients. Set <code>MAIL_MODE=live</code> with SMTP credentials to enable delivery.
        </span>
      </div>
    </div>
  );
}
