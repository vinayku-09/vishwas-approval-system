'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
  AlertTriangle,
  ArrowLeft,
  Bell,
  Calendar,
  CheckCircle2,
  ClipboardList,
  FileText,
  Hash,
  Lock,
  MapPin,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Undo2,
  XCircle,
} from 'lucide-react';
import { CaseSummary } from '../../../lib/types';
import { getCaseSummary, getStoredUser, dashboardHomePath, isAuthenticated } from '../../../lib/api';
import { StatusBadge } from '../../../components/StatusBadge';
import { SlaBadge } from '../../../components/SlaBadge';
import { RouteSequence } from '../../../components/RouteSequence';
import { DeficiencyList } from '../../../components/DeficiencyList';
import { SafeguardNotice } from '../../../components/SafeguardNotice';
import { formatDate, shortHash } from '../../../lib/utils';

export default function CaseSummaryPage() {
  const params = useParams();
  const id = params?.id as string;
  const router = useRouter();

  const [authorized, setAuthorized] = useState(false);
  const [summary, setSummary] = useState<CaseSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const res = await getCaseSummary(id);
      if (!res.data) {
        setSummary(null);
        setError(
          'The electronic case summary is unavailable. Sign in with an authorised account and ensure the backend is reachable.'
        );
        return;
      }
      setSummary(res.data);
    } catch (err: unknown) {
      setSummary(null);
      setError(err instanceof Error ? err.message : 'Unable to load the case summary.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (!isAuthenticated()) {
      router.replace(`/login?next=${encodeURIComponent(`/case/${id ?? ''}`)}`);
      return;
    }
    setAuthorized(true);
  }, [router, id]);

  useEffect(() => {
    if (authorized) void loadData();
  }, [authorized, loadData]);

  if (!authorized) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-8 text-sm text-slate-600">
        Redirecting to sign in…
      </div>
    );
  }

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-2xl border border-slate-200 p-12 flex items-center justify-center gap-3 text-slate-600">
          <RefreshCw className="w-5 h-5 animate-spin" />
          <span className="text-sm font-semibold">Assembling read-only case summary...</span>
        </div>
      </div>
    );
  }

  const backHref = dashboardHomePath(getStoredUser());

  if (!summary) {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-4">
        <Link
          href={backHref}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-gov-blue-800"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Dashboard</span>
        </Link>
        <div className="bg-red-50 border border-red-200 rounded-2xl p-6 text-red-900">
          <div className="flex items-center gap-2 font-bold text-sm">
            <AlertTriangle className="w-5 h-5 text-red-600" />
            <span>Case summary unavailable</span>
          </div>
          <p className="text-xs mt-2 leading-relaxed">{error}</p>
        </div>
      </div>
    );
  }

  const app = summary.application;
  const route = summary.route;

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-5">
      <div className="flex items-center justify-between gap-3">
        <Link
          href={backHref}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-gov-blue-800"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Dashboard</span>
        </Link>
        <button
          onClick={loadData}
          type="button"
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Refresh summary</span>
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-xs font-bold text-gov-blue-800 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                {app.id}
              </span>
              <span className="inline-flex items-center gap-1 text-[10px] font-extrabold uppercase tracking-wider text-indigo-800 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-full">
                <Lock className="w-3 h-3" />
                Read-only electronic case summary
              </span>
            </div>
            <h1 className="text-2xl font-extrabold text-slate-900 mt-2">{app.institutionName}</h1>
            <p className="text-xs text-slate-500 mt-1">
              {app.type.replace(/_/g, ' ')} · {app.region ?? 'Region not set'} · created{' '}
              {formatDate(app.createdAt)}
            </p>
            <p className="text-[10px] text-slate-400 mt-1">
              Generated {formatDate(summary.generatedAt)} · immutable view derived from stored records
              and the audit ledger
            </p>
          </div>
          <div className="flex items-center gap-2">
            <StatusBadge status={app.status} size="md" />
            <SlaBadge createdAt={app.createdAt} slaDueAt={app.slaDueAt} />
          </div>
        </div>

        <SafeguardNotice />

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <p className="text-[10px] font-bold text-slate-400 uppercase">Approval route</p>
            <p className="text-xs font-bold text-slate-900 mt-1">{route.name}</p>
            <p className="text-[11px] text-slate-500 mt-0.5">{route.id}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <p className="text-[10px] font-bold text-slate-400 uppercase">Current stage</p>
            <p className="text-xs font-bold text-slate-900 mt-1">{route.currentStage}</p>
            <p className="text-[11px] text-slate-500 mt-0.5">
              {route.currentIndex + 1} of {route.stages.length} configured stages
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <p className="text-[10px] font-bold text-slate-400 uppercase">Automatic next stage</p>
            <p className="text-xs font-bold text-slate-900 mt-1">
              {route.autoNextStatus ?? 'Human action required'}
            </p>
            <p className="text-[11px] text-slate-500 mt-0.5">Configured, pending APH</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <p className="text-[10px] font-bold text-slate-400 uppercase">Ledger integrity</p>
            <p
              className={`text-xs font-bold mt-1 ${
                summary.ledger.valid ? 'text-emerald-700' : 'text-red-700'
              }`}
            >
              {summary.ledger.valid ? 'Verified' : 'Integrity issue'}
            </p>
            <p className="text-[11px] text-slate-500 mt-0.5">
              {summary.ledger.totalEntries} linked entries
            </p>
          </div>
        </div>

        <div className="pt-2">
          <RouteSequence route={route} />
        </div>
      </div>

      {summary.returns.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-3">
          <h2 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
            <Undo2 className="w-4 h-4 text-amber-700" />
            <span>Return / revert history ({summary.returns.length})</span>
          </h2>
          <div className="space-y-2">
            {summary.returns.map((record) => (
              <div key={record.id} className="rounded-xl border border-amber-200 bg-amber-50/60 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs font-bold text-amber-950">
                    {record.fromStatus} → {record.toStatus} · {record.category}
                  </p>
                  <p className="text-[10px] text-amber-800">
                    {formatDate(record.timestamp)} · {record.actor}
                  </p>
                </div>
                <p className="text-[11px] text-amber-900 mt-1 leading-relaxed">{record.reason}</p>
                <p className="text-[10px] text-amber-700 mt-1 font-mono">{record.id}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 space-y-5">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-3">
            <h2 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
              <ClipboardList className="w-4 h-4 text-gov-blue-800" />
              <span>Scrutiny & deficiencies</span>
            </h2>
            <DeficiencyList deficiencies={app.deficiencies} />
            {app.extracted && (
              <div className="grid sm:grid-cols-2 gap-2 text-[11px] text-slate-600">
                <div className="rounded-lg border border-slate-200 p-2">
                  Land area: {app.extracted.landAreaSqm?.toLocaleString() ?? 'Not extracted'} sq.m
                </div>
                <div className="rounded-lg border border-slate-200 p-2">
                  Lease ends: {app.extracted.leaseEndDate ?? 'Not extracted'}
                </div>
                <div className="rounded-lg border border-slate-200 p-2">
                  Fire NOC expiry: {app.extracted.fireNocExpiry ?? 'Not extracted'}
                </div>
                <div className="rounded-lg border border-slate-200 p-2">
                  Extraction source: {app.extractedDetails?.source ?? 'stored record'}
                </div>
              </div>
            )}
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-3">
            <h2 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
              <Hash className="w-4 h-4 text-slate-700" />
              <span>Electronic timeline</span>
            </h2>
            {summary.timeline.length === 0 ? (
              <p className="text-xs text-slate-500">No ledger events recorded yet.</p>
            ) : (
              <div className="space-y-2">
                {summary.timeline.map((entry) => (
                  <div
                    key={entry.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 border-l-2 border-slate-200 pl-3 py-1"
                  >
                    <div>
                      <p className="text-xs font-bold text-slate-800">{entry.eventType}</p>
                      <p className="text-[10px] text-slate-500">
                        {formatDate(entry.at)} · {entry.actor}
                        {entry.status ? ` · ${entry.status}` : ''}
                      </p>
                    </div>
                    <span className="text-[10px] font-mono text-slate-400">{entry.id}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-3">
            <h2 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
              <FileText className="w-4 h-4 text-indigo-700" />
              <span>Documents & hashes</span>
            </h2>
            {summary.documents.length === 0 ? (
              <p className="text-xs text-slate-500">No documents registered.</p>
            ) : (
              <div className="space-y-2">
                {summary.documents.map((document) => (
                  <div
                    key={document.id}
                    className="rounded-lg border border-slate-200 p-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-1"
                  >
                    <div>
                      <p className="text-xs font-bold text-slate-800">
                        {document.docType.replace(/_/g, ' ')}
                      </p>
                      <p className="text-[10px] text-slate-500">
                        {document.fileName} · {formatDate(document.uploadedAt)}
                      </p>
                    </div>
                    <span className="text-[10px] font-mono text-slate-500" title={document.sha256}>
                      SHA-256 {shortHash(document.sha256)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="space-y-5">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-3">
            <h2 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
              {summary.ledger.valid ? (
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
              ) : (
                <ShieldAlert className="w-4 h-4 text-red-600" />
              )}
              <span>Audit ledger</span>
            </h2>
            <p className={`text-xs ${summary.ledger.valid ? 'text-emerald-800' : 'text-red-800'}`}>
              {summary.ledger.message}
            </p>
            <p className="text-[11px] text-slate-500">
              {summary.ledger.totalEntries} entries
              {summary.ledger.brokenAt ? ` · broken at ${summary.ledger.brokenAt}` : ''}
            </p>
            <Link
              href={`/verify/${app.id}`}
              className="inline-flex items-center gap-1 text-[11px] font-bold text-gov-blue-800 hover:underline"
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              Open public ledger proof
            </Link>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-3">
            <h2 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>Officer sign-off</span>
            </h2>
            {summary.signoff ? (
              <div className="space-y-1 text-[11px] text-slate-600">
                <p className="text-xs font-bold text-slate-900">
                  {summary.signoff.decision === 'CONFIRM' ? 'Confirmed' : 'Overridden'}
                </p>
                <p>Officer: {summary.signoff.officer}</p>
                <p>At: {formatDate(summary.signoff.timestamp)}</p>
                {summary.signoff.remarks && (
                  <p className="text-slate-700 mt-1">{summary.signoff.remarks}</p>
                )}
              </div>
            ) : (
              <p className="text-xs text-slate-500">No sign-off recorded.</p>
            )}
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-3">
            <h2 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
              <Calendar className="w-4 h-4 text-purple-700" />
              <span>Inspections</span>
            </h2>
            {summary.inspections.length === 0 ? (
              <p className="text-xs text-slate-500">No EVC inspection scheduled.</p>
            ) : (
              summary.inspections.map((inspection) => (
                <div key={inspection.id} className="rounded-lg border border-slate-200 p-2.5 space-y-1">
                  <p className="text-xs font-bold text-slate-900">
                    {inspection.status} · {formatDate(inspection.scheduledDate)}
                  </p>
                  <p className="text-[11px] text-slate-600 flex items-center gap-1">
                    <MapPin className="w-3 h-3" />
                    {inspection.inspectors.map((inspector) => inspector.name).join(', ') || 'Unassigned'}
                  </p>
                  {inspection.report && (
                    <p className="text-[10px] text-purple-800">
                      Report: {inspection.report.recommendation} ·{' '}
                      {formatDate(inspection.report.submittedAt)}
                    </p>
                  )}
                </div>
              ))
            )}
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-3">
            <h2 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
              <Bell className="w-4 h-4 text-amber-700" />
              <span>Notices & notifications</span>
            </h2>
            {summary.notices.length === 0 ? (
              <p className="text-xs text-slate-500">No notices issued.</p>
            ) : (
              <div className="space-y-2">
                {summary.notices.map((notice) => (
                  <div key={notice.id} className="rounded-lg border border-slate-200 p-2.5">
                    <p className="text-xs font-bold text-slate-900">{notice.title}</p>
                    <p className="text-[10px] text-slate-500 mt-0.5">{formatDate(notice.createdAt)}</p>
                    <p className="text-[11px] text-slate-600 mt-1 leading-relaxed">{notice.message}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-3">
        <h2 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
          <XCircle className="w-4 h-4 text-rose-700" />
          <span>Compliance documents</span>
        </h2>
        {summary.complianceDocuments.length === 0 ? (
          <p className="text-xs text-slate-500">No compliance documents tracked.</p>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {summary.complianceDocuments.map((document) => (
              <div key={document.id} className="rounded-lg border border-slate-200 p-2.5">
                <p className="text-xs font-bold text-slate-900">
                  {document.docType.replace(/_/g, ' ')}
                </p>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Expires {formatDate(document.expiryDate)} · {document.daysRemaining} days
                </p>
                <p
                  className={`text-[10px] font-bold mt-1 ${
                    document.state === 'OVERDUE'
                      ? 'text-red-700'
                      : document.state === 'WARNING'
                      ? 'text-amber-700'
                      : 'text-emerald-700'
                  }`}
                >
                  {document.state}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
