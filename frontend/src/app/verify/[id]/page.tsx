'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  ShieldCheck,
  ShieldAlert,
  ArrowLeft,
  RefreshCw,
  Hash,
  Clock,
  User,
  Database,
  CheckCircle2,
  AlertTriangle,
  Bug,
  FileCode,
} from 'lucide-react';
import { Application, LedgerEntry, VerificationResult } from '../../../lib/types';
import {
  getApplication,
  getLedger,
  verifyLedger,
  tamperLedger,
  getStoredUser,
  isAuthenticated,
} from '../../../lib/api';
import { StatusBadge } from '../../../components/StatusBadge';
import { formatDate, shortHash } from '../../../lib/utils';

const EVENT_TYPE_LABELS: Record<string, { label: string; color: string }> = {
  APPLICATION_CREATED: { label: 'Application Created', color: 'bg-blue-100 text-blue-800' },
  DOCUMENT_UPLOADED: { label: 'Document Uploaded & Hashed', color: 'bg-emerald-100 text-emerald-800' },
  EXTRACTION_COMPLETED: { label: 'AI Document Scrutiny & Extraction', color: 'bg-indigo-100 text-indigo-800' },
  SCRUTINY_COMPLETED: { label: 'AICTE Rules Scrutiny Evaluated', color: 'bg-purple-100 text-purple-800' },
  SCRUTINY_RULE_EVALUATION: { label: 'Scrutiny Rule Evaluation', color: 'bg-indigo-100 text-indigo-800' },
  SCRUTINY_EVALUATED_DEFICIENT: { label: 'Scrutiny Deficiencies Recorded', color: 'bg-rose-100 text-rose-800' },
  SCRUTINY_PASSED: { label: 'Scrutiny Criteria Passed', color: 'bg-emerald-100 text-emerald-800' },
  SIGNOFF: { label: 'Officer Sign-Off (Confirmed)', color: 'bg-emerald-100 text-emerald-800' },
  OVERRIDE: { label: 'Officer Regulatory Override', color: 'bg-amber-100 text-amber-800' },
  COMPLIANCE_EXPIRY_WARNING: { label: 'Document Expiry Warning', color: 'bg-amber-100 text-amber-800' },
  COMPLIANCE_DOCUMENT_OVERDUE: { label: 'Document Overdue Alert', color: 'bg-red-100 text-red-800' },
  APPLICATION_LOCKED: { label: 'Application Locked (Compliance)', color: 'bg-red-100 text-red-800' },
  WORKFLOW_STATE_ADVANCED: { label: 'Workflow State Advanced', color: 'bg-sky-100 text-sky-800' },
  EVC_INSPECTION_COMPLETED: { label: 'EVC Inspection Completed', color: 'bg-purple-100 text-purple-800' },
  EXECUTIVE_COMMITTEE_APPROVAL: { label: 'Executive Committee Approval', color: 'bg-emerald-100 text-emerald-800' },
};

export default function VerifyPage() {
  const params = useParams();
  const id = params?.id as string;

  const [application, setApplication] = useState<Application | null>(null);
  const [ledgerEntries, setLedgerEntries] = useState<LedgerEntry[]>([]);
  const [verification, setVerification] = useState<VerificationResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [tampering, setTampering] = useState(false);
  const [bannerMessage, setBannerMessage] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [accessNotice, setAccessNotice] = useState<string | null>(null);
  const [isChief, setIsChief] = useState(false);

  useEffect(() => {
    setIsChief(getStoredUser()?.role?.toUpperCase() === 'CHIEF');
  }, []);

  const loadData = async () => {
    if (!id) return;
    setLoading(true);
    setLoadError(null);
    setAccessNotice(null);

    try {
      const verifyRes = await verifyLedger(id);
      setVerification(verifyRes.data || null);

      if (!isAuthenticated()) {
        setApplication(null);
        setLedgerEntries([]);
        setAccessNotice(
          'Sign in to view the institution details and the full audit trail. The cryptographic validity check above remains public.'
        );
        return;
      }

      try {
        const [appRes, ledgerRes] = await Promise.all([
          getApplication(id),
          getLedger(id),
        ]);
        setApplication(appRes.data);
        setLedgerEntries(ledgerRes.data || []);
      } catch (err) {
        setApplication(null);
        setLedgerEntries([]);
        setAccessNotice(
          err instanceof Error
            ? err.message
            : 'Your account cannot access this audit trail.'
        );
      }
    } catch (err) {
      setVerification(null);
      setLoadError(
        err instanceof Error ? err.message : 'Unable to verify this application.'
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [id]);

  const handleSimulateTampering = async () => {
    if (!id) return;
    setTampering(true);
    try {
      const res = await tamperLedger(id);
      setBannerMessage(res.data.message || 'Tampered block payload in memory.');
      // Refresh verification to recompute hash chain immediately
      await loadData();
    } catch (err) {
      setLoadError(
        err instanceof Error ? err.message : 'Tamper simulation failed.'
      );
    } finally {
      setTampering(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">

      {/* Back button */}
      <div>
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-gov-blue-800 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Home</span>
        </Link>
      </div>

      {/* Main Header / Verification Status Card */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 sm:p-8 space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-200">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs font-bold text-gov-blue-800 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                {id}
              </span>
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Public Verification Portal
              </span>
            </div>
            <h1 className="text-2xl font-extrabold text-slate-900 mt-1">
              {application?.institutionName || id}
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Type: {application?.type?.replace(/_/g, ' ') || 'Technical Institution'} | Created:{' '}
              {application ? formatDate(application.createdAt) : '...'}
            </p>
          </div>

          <div className="flex items-center gap-3">
            {application && <StatusBadge status={application.status} size="md" />}
            <button
              onClick={loadData}
              type="button"
              className="p-2.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-700 transition-colors"
              title="Re-verify Chain"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Dynamic Verification Banner: Green or Red */}
        {verification && (
          <div
            className={`p-5 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
              verification.valid
                ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                : 'bg-red-50 border-red-300 text-red-900 animate-pulse'
            }`}
          >
            <div className="flex items-start sm:items-center gap-3">
              {verification.valid ? (
                <ShieldCheck className="w-8 h-8 text-emerald-600 flex-shrink-0" />
              ) : (
                <ShieldAlert className="w-8 h-8 text-red-600 flex-shrink-0" />
              )}
              <div>
                <h3 className="text-base font-bold flex items-center gap-2">
                  {verification.valid ? 'Ledger Verified' : 'Tampering Detected'}
                </h3>
                <p className="text-xs mt-0.5 leading-relaxed">
                  {verification.message}
                </p>
              </div>
            </div>

            <div className="text-right flex-shrink-0">
              <span
                className={`text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-full ${
                  verification.valid
                    ? 'bg-emerald-600 text-white'
                    : 'bg-red-600 text-white shadow-sm'
                }`}
              >
                {verification.valid ? 'Cryptographically Sound' : 'Chain Compromised'}
              </span>
            </div>
          </div>
        )}

        {loadError && (
          <div className="p-4 rounded-xl border border-red-200 bg-red-50 text-red-800 text-xs">
            <strong>Verification unavailable:</strong> {loadError}
          </div>
        )}

        {accessNotice && (
          <div className="p-4 rounded-xl border border-amber-200 bg-amber-50 text-amber-900 text-xs">
            {accessNotice}{' '}
            {!isAuthenticated() && (
              <Link
                href={`/login?next=${encodeURIComponent(`/verify/${id}`)}`}
                className="font-bold underline"
              >
                Sign in
              </Link>
            )}
          </div>
        )}

        {isChief && (
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <Bug className="w-4 h-4 text-amber-600" />
                Evaluation Demo: Cryptographic Tamper Test (CHIEF only)
              </span>
              <p className="text-[11px] text-slate-500">
                Simulate an unauthorized database hack modifying an entry payload without recalculating its SHA-256 hash. The verification algorithm will immediately flag the mismatch.
              </p>
            </div>
            <button
              onClick={handleSimulateTampering}
              disabled={tampering}
              type="button"
              className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-bold shadow-sm transition-all flex items-center gap-1.5 flex-shrink-0 disabled:opacity-50"
            >
              {tampering && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
              <span>Simulate DB Tampering</span>
            </button>
          </div>
        )}
      </div>

      {/* Cryptographic Hash Chain Entries */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 sm:p-8 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-200 pb-4">
          <div>
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Database className="w-4 h-4 text-gov-blue-800" />
              Append-Only Audit Ledger Blocks ({ledgerEntries.length})
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Hash formula: <code className="text-xs bg-slate-100 px-1 py-0.5 rounded font-mono">SHA256(prevHash + canonicalJSON(entry))</code>
            </p>
          </div>
          <span className="text-xs text-slate-400 font-mono">Algorithm: SHA-256</span>
        </div>

        {ledgerEntries.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-xs">No blocks found.</div>
        ) : (
          <div className="space-y-4 pt-2">
            {ledgerEntries.map((entry, idx) => {
              const isTamperedEntry =
                (entry.payload as Record<string, unknown>)?._tampered === true;

              return (
                <div
                  key={entry.id}
                  className={`p-4 rounded-xl border transition-all ${
                    isTamperedEntry
                      ? 'bg-red-50/70 border-red-300 ring-2 ring-red-400'
                      : 'bg-slate-50/50 border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-200/70">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold font-mono text-gov-blue-900 bg-white px-2 py-0.5 rounded border border-slate-200 shadow-xs">
                        Block #{idx + 1} ({entry.id})
                      </span>
                      {EVENT_TYPE_LABELS[entry.eventType] ? (
                        <span
                          className={`text-xs font-bold px-2.5 py-0.5 rounded border border-current/10 ${
                            EVENT_TYPE_LABELS[entry.eventType].color
                          }`}
                        >
                          {EVENT_TYPE_LABELS[entry.eventType].label}
                        </span>
                      ) : (
                        <span className="text-xs font-bold text-slate-700 bg-slate-200 px-2 py-0.5 rounded">
                          {entry.eventType}
                        </span>
                      )}
                      {isTamperedEntry && (
                        <span className="text-[10px] font-bold uppercase bg-red-600 text-white px-1.5 py-0.5 rounded animate-pulse">
                          Tampered
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-slate-500">
                      <span className="flex items-center gap-1">
                        <User className="w-3.5 h-3.5 text-slate-400" />
                        Actor: <strong className="text-slate-700 capitalize">{entry.actor}</strong>
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 text-slate-400" />
                        {formatDate(entry.timestamp)}
                      </span>
                    </div>
                  </div>

                  {/* Cryptographic Hashes */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 py-3 text-xs font-mono">
                    <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                      <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">
                        Previous Block Hash (prevHash)
                      </span>
                      <span
                        className="text-slate-600 break-all"
                        title={entry.prevHash}
                      >
                        {entry.prevHash === '0000000000000000000000000000000000000000000000000000000000000000'
                          ? '0000...0000 (GENESIS)'
                          : shortHash(entry.prevHash, 14)}
                      </span>
                    </div>
                    <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                      <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">
                        Block Hash (SHA-256)
                      </span>
                      <span
                        className="text-gov-blue-900 font-bold break-all"
                        title={entry.hash}
                      >
                        {shortHash(entry.hash, 14)}
                      </span>
                    </div>
                  </div>

                  {/* Payload Details */}
                  <div className="pt-1">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
                      Payload Snapshot
                    </span>
                    <pre className="text-[11px] bg-slate-900 text-slate-100 p-3 rounded-lg overflow-x-auto font-mono leading-relaxed">
                      {JSON.stringify(entry.payload, null, 2)}
                    </pre>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
