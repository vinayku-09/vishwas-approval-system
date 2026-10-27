'use client';

import React, { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { CheckCircle2, XCircle, Loader2, ArrowRight, ShieldCheck } from 'lucide-react';
import { verifyEmail } from '../../lib/api';

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  const [loading, setLoading] = useState(true);
  const [success, setSuccess] = useState(false);
  const [message, setMessage] = useState<string>('');

  useEffect(() => {
    if (!token) {
      setLoading(false);
      setSuccess(false);
      setMessage('Missing verification token. Please check your verification link.');
      return;
    }

    verifyEmail(token).then((res) => {
      setLoading(false);
      if (res.error) {
        setSuccess(false);
        setMessage(res.error);
      } else {
        setSuccess(true);
        setMessage(res.message || 'Your email address has been verified successfully!');
      }
    });
  }, [token]);

  return (
    <div className="max-w-md w-full bg-white rounded-2xl p-8 shadow-xl border border-slate-200 text-center">
      <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-gov-blue-50 border border-gov-blue-100 text-[11px] font-bold text-gov-blue-900 mb-6">
        <ShieldCheck className="w-3.5 h-3.5" />
        AICTE Identity Verification
      </div>

      {loading ? (
        <div className="py-8">
          <Loader2 className="w-10 h-10 text-gov-blue-800 animate-spin mx-auto" />
          <h2 className="text-lg font-bold text-slate-800 mt-4">Verifying Email...</h2>
          <p className="text-xs text-slate-500 mt-1">Checking cryptographic token validity</p>
        </div>
      ) : success ? (
        <div>
          <div className="w-14 h-14 mx-auto rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-slate-900 mt-4">Email Verified</h2>
          <p className="text-sm text-slate-600 mt-2 leading-relaxed">{message}</p>
          <div className="mt-8">
            <Link
              href="/login"
              className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-gov-blue-900 text-white text-sm font-bold px-5 py-3 hover:bg-gov-blue-800 transition-colors"
            >
              Sign In to Portal
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      ) : (
        <div>
          <div className="w-14 h-14 mx-auto rounded-full bg-red-100 text-red-600 flex items-center justify-center">
            <XCircle className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-slate-900 mt-4">Verification Failed</h2>
          <p className="text-sm text-red-700 mt-2 leading-relaxed">{message}</p>
          <div className="mt-8 space-y-3">
            <Link
              href="/register"
              className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-gov-blue-900 text-white text-sm font-bold px-5 py-2.5 hover:bg-gov-blue-800 transition-colors"
            >
              Register Again
            </Link>
            <div>
              <Link href="/login" className="text-xs text-slate-500 hover:text-slate-800 underline">
                Back to Sign In
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <div className="min-h-[calc(100vh-8rem)] bg-slate-100 flex items-center justify-center px-4 py-12">
      <Suspense
        fallback={
          <div className="max-w-md w-full bg-white rounded-2xl p-8 shadow-xl border border-slate-200 text-center py-12">
            <Loader2 className="w-8 h-8 text-gov-blue-800 animate-spin mx-auto" />
            <p className="text-xs text-slate-500 mt-2">Loading verification portal...</p>
          </div>
        }
      >
        <VerifyEmailContent />
      </Suspense>
    </div>
  );
}
