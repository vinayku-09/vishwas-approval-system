'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ClipboardCheck,
  Filter,
  RefreshCw,
  Sparkles,
  ArrowRightCircle,
  ShieldCheck,
  CheckCircle,
  AlertTriangle,
  Lock,
  FileCheck2,
  CheckCheck,
  XCircle,
  X,
  MessageSquare,
  AlertCircle,
} from 'lucide-react';
import { Application, ApplicationType, Status, SignoffDecision } from '../../lib/types';
import {
  getApplications,
  runExtract,
  advanceApplication,
  recordSignoff,
} from '../../lib/api';
import { StatusBadge } from '../../components/StatusBadge';
import { SlaBadge } from '../../components/SlaBadge';
import { DemoBanner } from '../../components/DemoBanner';
import { DeficiencyList } from '../../components/DeficiencyList';

const NEXT_STATE_TRANSITIONS: Record<Status, Status[]> = {
  SUBMITTED: ['SCRUTINY'],
  SCRUTINY: ['DEFICIENT', 'EVC_REQUIRED', 'DECISION'],
  DEFICIENT: ['SCRUTINY'],
  EVC_REQUIRED: ['EVC_DONE'],
  EVC_DONE: ['DECISION'],
  DECISION: ['APPROVED', 'REJECTED'],
  REJECTED: ['APPEAL_SHC'],
  APPEAL_SHC: ['APPEAL_SAC', 'APPROVED'],
  APPEAL_SAC: ['APPROVED', 'REJECTED'],
  APPROVED: [],
};

export default function OfficerPage() {
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDemo, setIsDemo] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'warning' } | null>(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [typeFilter, setTypeFilter] = useState<string>('ALL');

  // Review & Sign-Off modal
  const [reviewApp, setReviewApp] = useState<Application | null>(null);
  const [signoffModalDecision, setSignoffModalDecision] = useState<SignoffDecision | null>(null);
  const [signoffRemarks, setSignoffRemarks] = useState('');
  const [signoffSubmitting, setSignoffSubmitting] = useState(false);

  // Advance modal
  const [advancingApp, setAdvancingApp] = useState<Application | null>(null);
  const [selectedNextStatus, setSelectedNextStatus] = useState<Status | ''>('');
  const [advanceRemarks, setAdvanceRemarks] = useState('');
  const [overrideRemarks, setOverrideRemarks] = useState('');

  const loadData = async () => {
    setLoading(true);
    const filters: { status?: Status; type?: ApplicationType } = {};
    if (statusFilter !== 'ALL') filters.status = statusFilter as Status;
    if (typeFilter !== 'ALL') filters.type = typeFilter as ApplicationType;

    const res = await getApplications(filters);
    setApplications(res.data || []);
    setIsDemo(res.isDemo);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, [statusFilter, typeFilter]);

  const showToast = (message: string, type: 'success' | 'error' | 'warning' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 5000);
  };

  const handleRunExtract = async (app: Application) => {
    setActionLoadingId(app.id);
    try {
      const res = await runExtract(app.id);
      const newStatus = res.data.application.status;
      const defCount = res.data.deficiencies.length;

      showToast(
        defCount > 0
          ? `AI Extraction Complete: ${defCount} deficiency clause(s) flagged. Moved to ${newStatus}.`
          : `AI Extraction Passed: All norms met. Moved to ${newStatus}.`,
        defCount > 0 ? 'warning' : 'success'
      );
      await loadData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      showToast(`Extraction failed: ${msg}`, 'error');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleSignoffSubmit = async () => {
    if (!reviewApp || !signoffModalDecision) return;

    if (signoffModalDecision === 'OVERRIDE' && !signoffRemarks.trim()) {
      showToast('Remarks are required for an OVERRIDE sign-off', 'error');
      return;
    }

    setSignoffSubmitting(true);
    try {
      const deficiencyIds = reviewApp.deficiencies.map((d) => d.id);
      const res = await recordSignoff(reviewApp.id, {
        decision: signoffModalDecision,
        deficiencyIds,
        remarks: signoffRemarks,
      });

      if (res.data?.success) {
        showToast(
          `Officer sign-off recorded (${signoffModalDecision}). Updated in audit ledger.`,
          'success'
        );
        setSignoffModalDecision(null);
        setSignoffRemarks('');
        setReviewApp(res.data.application);
        await loadData();
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      showToast(`Sign-off failed: ${msg}`, 'error');
    } finally {
      setSignoffSubmitting(false);
    }
  };

  const openAdvanceDialog = (app: Application) => {
    setAdvancingApp(app);
    const validNext = NEXT_STATE_TRANSITIONS[app.status] || [];
    setSelectedNextStatus(validNext[0] || '');
    setAdvanceRemarks('');
    setOverrideRemarks('');
  };

  const handleConfirmAdvance = async () => {
    if (!advancingApp || !selectedNextStatus) return;

    setActionLoadingId(advancingApp.id);
    try {
      await advanceApplication(
        advancingApp.id,
        selectedNextStatus as Status,
        advanceRemarks,
        overrideRemarks
      );
      showToast(`Successfully advanced ${advancingApp.id} to ${selectedNextStatus}`, 'success');
      setAdvancingApp(null);
      await loadData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      showToast(msg, 'error');
    } finally {
      setActionLoadingId(null);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <DemoBanner show={isDemo} />

      {/* Floating Toast Notification */}
      {toast && (
        <div
          className={`fixed bottom-6 right-6 z-50 px-5 py-3.5 rounded-xl shadow-2xl border text-xs font-semibold flex items-center gap-2.5 animate-bounce ${
            toast.type === 'error'
              ? 'bg-red-900 border-red-700 text-white'
              : toast.type === 'warning'
              ? 'bg-amber-900 border-amber-700 text-amber-100'
              : 'bg-slate-900 border-slate-700 text-white'
          }`}
        >
          {toast.type === 'error' ? (
            <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
          ) : toast.type === 'warning' ? (
            <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0" />
          ) : (
            <CheckCircle className="w-4 h-4 text-emerald-400 flex-shrink-0" />
          )}
          <span>{toast.message}</span>
        </div>
      )}

      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
        <div>
          <div className="flex items-center gap-2 text-gov-blue-800">
            <ClipboardCheck className="w-5 h-5 text-amber-600" />
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
              Scrutiny Officer Review & Sign-Off Queue
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-slate-600 mt-1">
            Evaluate AI document extraction, sign-off on regulatory non-compliance, and enforce strict lock & sign-off gates.
          </p>
        </div>

        <button
          onClick={loadData}
          type="button"
          className="self-start sm:self-auto px-3.5 py-2 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold flex items-center gap-2 shadow-sm transition-colors"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh Queue</span>
        </button>
      </div>

      {/* Filters Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase tracking-wider">
          <Filter className="w-4 h-4" />
          Queue Filters:
        </div>

        <div className="flex items-center gap-2">
          <label className="text-xs text-slate-600 font-semibold">Status:</label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs bg-slate-50 font-medium"
          >
            <option value="ALL">All Statuses</option>
            <option value="SUBMITTED">SUBMITTED</option>
            <option value="SCRUTINY">SCRUTINY</option>
            <option value="DEFICIENT">DEFICIENT</option>
            <option value="EVC_REQUIRED">EVC_REQUIRED</option>
            <option value="EVC_DONE">EVC_DONE</option>
            <option value="DECISION">DECISION</option>
            <option value="APPROVED">APPROVED</option>
            <option value="REJECTED">REJECTED</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-xs text-slate-600 font-semibold">Type:</label>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs bg-slate-50 font-medium"
          >
            <option value="ALL">All Application Types</option>
            <option value="NEW">New Institution</option>
            <option value="EXTENSION_OF_APPROVAL">Extension of Approval</option>
            <option value="INTAKE_CHANGE">Intake Expansion</option>
          </select>
        </div>
      </div>

      {/* Queue Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase font-bold tracking-wider">
              <tr>
                <th className="px-4 py-3">Application ID</th>
                <th className="px-4 py-3">Institution & Type</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">SLA Compliance</th>
                <th className="px-4 py-3">Sign-off Status</th>
                <th className="px-4 py-3 text-right">Officer Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-slate-400">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-gov-blue-800" />
                    Loading applications queue...
                  </td>
                </tr>
              ) : applications.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-12 text-center text-slate-500">
                    No applications match the current filter criteria.
                  </td>
                </tr>
              ) : (
                applications.map((app) => {
                  const validNext = NEXT_STATE_TRANSITIONS[app.status] || [];
                  const isActionBusy = actionLoadingId === app.id;
                  const hasConfirmSignoff = app.signoff?.decision === 'CONFIRM';

                  return (
                    <tr key={app.id} className="hover:bg-slate-50/70 transition-colors">
                      {/* ID & Lock Badge */}
                      <td className="px-4 py-3.5 font-mono font-bold text-gov-blue-900 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <Link
                            href={`/verify/${app.id}`}
                            className="hover:underline flex items-center gap-1"
                            title="Verify cryptographic hash chain"
                          >
                            <span>{app.id}</span>
                            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                          </Link>
                          {app.locked && (
                            <span title="Locked: expired compliance document" className="text-red-600">
                              <Lock className="w-3.5 h-3.5" />
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Institution & Type */}
                      <td className="px-4 py-3.5 max-w-xs">
                        <div className="font-bold text-slate-900 line-clamp-1">{app.institutionName}</div>
                        <div className="text-[11px] text-slate-500 uppercase tracking-wide mt-0.5">
                          {app.type.replace(/_/g, ' ')}
                        </div>
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <StatusBadge status={app.status} size="sm" />
                      </td>

                      {/* SLA */}
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <SlaBadge createdAt={app.createdAt} slaDueAt={app.slaDueAt} />
                      </td>

                      {/* Sign-Off Status */}
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        {app.signoff ? (
                          <span
                            className={`inline-flex items-center gap-1 font-bold text-[11px] px-2 py-0.5 rounded border ${
                              app.signoff.decision === 'CONFIRM'
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : 'bg-amber-50 text-amber-700 border-amber-200'
                            }`}
                          >
                            <CheckCheck className="w-3 h-3" />
                            {app.signoff.decision}
                          </span>
                        ) : (
                          <span className="text-[11px] text-slate-400 italic">Pending Sign-off</span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3.5 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5">
                          {/* Run AI Extraction */}
                          <button
                            onClick={() => handleRunExtract(app)}
                            disabled={isActionBusy}
                            type="button"
                            className="px-2.5 py-1.5 rounded bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-semibold border border-indigo-200 text-[11px] transition-colors flex items-center gap-1 disabled:opacity-50"
                            title="Run AI Extraction & Rules"
                          >
                            <Sparkles className="w-3 h-3" />
                            <span>Run Extract</span>
                          </button>

                          {/* Review & Sign-Off */}
                          <button
                            onClick={() => setReviewApp(app)}
                            type="button"
                            className="px-2.5 py-1.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-[11px] transition-colors flex items-center gap-1"
                          >
                            <FileCheck2 className="w-3 h-3" />
                            <span>Review</span>
                          </button>

                          {/* Advance State Dropdown Button */}
                          {validNext.length > 0 ? (
                            <button
                              onClick={() => openAdvanceDialog(app)}
                              disabled={isActionBusy}
                              type="button"
                              className="px-2.5 py-1.5 rounded bg-gov-blue-900 hover:bg-gov-blue-800 text-white font-semibold text-[11px] transition-colors flex items-center gap-1 shadow-sm disabled:opacity-50"
                            >
                              <span>Advance</span>
                              <ArrowRightCircle className="w-3 h-3 text-gov-saffron" />
                            </button>
                          ) : (
                            <span className="text-[11px] text-slate-400 italic px-2">Terminal</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* REVIEW & HUMAN SIGN-OFF MODAL */}
      {reviewApp && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full border border-slate-200 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-5 bg-gov-blue-900 text-white border-b-4 border-gov-saffron flex items-center justify-between">
              <div>
                <span className="font-mono text-xs font-bold bg-white/20 px-2 py-0.5 rounded text-white">
                  {reviewApp.id}
                </span>
                <h2 className="text-base font-bold mt-1">
                  Officer Review & Sign-off: {reviewApp.institutionName}
                </h2>
              </div>
              <button
                onClick={() => setReviewApp(null)}
                className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-5 overflow-y-auto flex-1">
              {/* Extraction Evidence & Confidence Panel */}
              <div className="space-y-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-indigo-600" />
                  AI Document Extraction Metrics
                </h3>

                {reviewApp.extractedDetails?.fields ? (
                  <div className="border border-slate-200 rounded-xl overflow-hidden">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                        <tr>
                          <th className="p-2.5">Field</th>
                          <th className="p-2.5">Value</th>
                          <th className="p-2.5">Confidence</th>
                          <th className="p-2.5">Evidence Snippet</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {Object.entries(reviewApp.extractedDetails.fields).map(([k, item]) => (
                          <tr key={k}>
                            <td className="p-2.5 font-semibold text-slate-800">{k}</td>
                            <td className="p-2.5 font-mono font-bold text-gov-blue-900">
                              {item.value !== undefined ? String(item.value) : 'N/A'}
                            </td>
                            <td className="p-2.5">
                              <span
                                className={`font-mono font-bold ${
                                  item.confidence < 0.7 ? 'text-amber-700' : 'text-emerald-700'
                                }`}
                              >
                                {Math.round(item.confidence * 100)}%
                              </span>
                            </td>
                            <td className="p-2.5 text-[11px] text-slate-600 italic">
                              "{item.evidenceText}"
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-xs text-slate-500 italic bg-slate-50 p-3 rounded-lg">
                    No rich AI extraction recorded yet.
                  </p>
                )}
              </div>

              {/* Deficiencies */}
              <div className="space-y-2">
                <DeficiencyList deficiencies={reviewApp.deficiencies} />
              </div>

              {/* Sign-Off Action Controls */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-bold text-slate-900 uppercase">
                      Regulatory Sign-Off Decision
                    </h4>
                    <p className="text-[11px] text-slate-500">
                      CONFIRM affirms deficiencies for formal rejection; OVERRIDE grants dispensation with mandatory justification.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    onClick={() => {
                      setSignoffModalDecision('CONFIRM');
                      setSignoffRemarks('Deficiencies reviewed and confirmed under AICTE APH Chapter I norms.');
                    }}
                    type="button"
                    className={`px-4 py-2 rounded-lg text-xs font-bold border transition-all flex items-center gap-1.5 ${
                      signoffModalDecision === 'CONFIRM'
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                        : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <CheckCheck className="w-4 h-4" />
                    <span>Confirm Deficiencies</span>
                  </button>

                  <button
                    onClick={() => {
                      setSignoffModalDecision('OVERRIDE');
                      setSignoffRemarks('');
                    }}
                    type="button"
                    className={`px-4 py-2 rounded-lg text-xs font-bold border transition-all flex items-center gap-1.5 ${
                      signoffModalDecision === 'OVERRIDE'
                        ? 'bg-amber-600 text-white border-amber-600 shadow-sm'
                        : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <AlertTriangle className="w-4 h-4" />
                    <span>Regulatory Override</span>
                  </button>
                </div>

                {signoffModalDecision && (
                  <div className="space-y-2 pt-2 border-t border-slate-200">
                    <label className="block text-xs font-bold text-slate-700">
                      Officer Justification / Executive Remarks {signoffModalDecision === 'OVERRIDE' && <span className="text-red-600">*</span>}
                    </label>
                    <textarea
                      rows={3}
                      placeholder={
                        signoffModalDecision === 'OVERRIDE'
                          ? 'MANDATORY: Provide formal regulatory basis for granting an override on flagged deficiencies.'
                          : 'Optional officer comments...'
                      }
                      value={signoffRemarks}
                      onChange={(e) => setSignoffRemarks(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs bg-white"
                    />

                    <div className="flex justify-end pt-1">
                      <button
                        onClick={handleSignoffSubmit}
                        disabled={signoffSubmitting}
                        type="button"
                        className="px-4 py-2 bg-gov-blue-900 text-white text-xs font-bold rounded-lg shadow-sm hover:bg-gov-blue-800 disabled:opacity-50 flex items-center gap-1.5"
                      >
                        {signoffSubmitting && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                        <span>Submit {signoffModalDecision} Sign-Off</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end">
              <button
                onClick={() => setReviewApp(null)}
                className="px-4 py-2 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-semibold"
              >
                Close Review
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ADVANCE WORKFLOW MODAL */}
      {advancingApp && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full border border-slate-200 shadow-2xl p-6 space-y-4">
            <div className="border-b border-slate-200 pb-3">
              <span className="font-mono text-xs font-bold text-gov-blue-800 bg-blue-50 px-2 py-0.5 rounded">
                {advancingApp.id}
              </span>
              <h2 className="text-base font-bold text-slate-900 mt-1">Advance Workflow State</h2>
              <p className="text-xs text-slate-500">
                Transitions gated by state machine, officer sign-off & document lock policy.
              </p>
            </div>

            {/* Lock warning inside advance modal */}
            {advancingApp.locked && (
              <div className="p-3 bg-red-50 border border-red-300 rounded-lg text-red-900 text-xs space-y-1">
                <div className="font-bold flex items-center gap-1.5">
                  <Lock className="w-4 h-4 text-red-600" />
                  <span>Application is Locked (Expired Document)</span>
                </div>
                <p className="text-[11px] leading-relaxed">
                  Advancing will return HTTP 423 unless an officer enters formal override remarks below.
                </p>
              </div>
            )}

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
                  Current Status
                </label>
                <StatusBadge status={advancingApp.status} size="md" />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Target Next Status *
                </label>
                <select
                  value={selectedNextStatus}
                  onChange={(e) => setSelectedNextStatus(e.target.value as Status)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white font-semibold"
                >
                  {(NEXT_STATE_TRANSITIONS[advancingApp.status] || []).map((target) => {
                    const isReject = target === 'REJECTED';
                    const isRejectDisabled = isReject && advancingApp.signoff?.decision !== 'CONFIRM';

                    return (
                      <option key={target} value={target} disabled={isRejectDisabled}>
                        {target} {isRejectDisabled ? '(Sign-off required)' : ''}
                      </option>
                    );
                  })}
                </select>
                {selectedNextStatus === 'REJECTED' && advancingApp.signoff?.decision !== 'CONFIRM' && (
                  <p className="text-[11px] text-red-600 mt-1 font-semibold">
                    Warning: Advancing to REJECTED requires an officer CONFIRM sign-off (HTTP 409).
                  </p>
                )}
              </div>

              {advancingApp.locked && (
                <div>
                  <label className="block text-xs font-bold text-red-700 uppercase mb-1">
                    Lock Override Remarks (Required to bypass 423) *
                  </label>
                  <textarea
                    rows={2}
                    placeholder="e.g. Approved temporary exemption per executive council resolution..."
                    value={overrideRemarks}
                    onChange={(e) => setOverrideRemarks(e.target.value)}
                    className="w-full px-3 py-2 border border-red-300 rounded-lg text-xs bg-red-50/30"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Workflow Remarks
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. Scrutiny verified, advancing to next workflow stage."
                  value={advanceRemarks}
                  onChange={(e) => setAdvanceRemarks(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                />
              </div>
            </div>

            <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setAdvancingApp(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmAdvance}
                disabled={!selectedNextStatus || actionLoadingId === advancingApp.id}
                className="px-5 py-2 text-xs font-bold text-white bg-gov-blue-900 hover:bg-gov-blue-800 rounded-lg shadow-sm disabled:opacity-50 flex items-center gap-1.5"
              >
                {actionLoadingId === advancingApp.id && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                <span>Confirm State Transition</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
