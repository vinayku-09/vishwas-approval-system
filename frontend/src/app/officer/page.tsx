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
  Calendar,
  Compass,
  MapPin,
  TrendingDown,
  UserCheck,
  Users,
} from 'lucide-react';
import {
  Application,
  ApplicationType,
  OptimizationResult,
  SignoffDecision,
  Status,
} from '../../lib/types';
import {
  getApplications,
  runExtract,
  advanceApplication,
  recordSignoff,
  optimizeScheduling,
  scheduleEvc,
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

  // Phase A: EVC Scheduling & Optimization state
  const [activeTab, setActiveTab] = useState<'APPLICATIONS' | 'EVC_OPTIMIZER'>('APPLICATIONS');
  const [startDate, setStartDate] = useState('2026-11-01');
  const [endDate, setEndDate] = useState('2026-11-07');
  const [optimizing, setOptimizing] = useState(false);
  const [optimizationResult, setOptimizationResult] = useState<OptimizationResult | null>(null);
  const [schedulingAppId, setSchedulingAppId] = useState<string | null>(null);

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

  const handleRunOptimizer = async () => {
    setOptimizing(true);
    try {
      const res = await optimizeScheduling({ startDate, endDate });
      if (res.data) {
        setOptimizationResult(res.data);
        showToast(
          `EVC Routes Solved (${res.data.source.toUpperCase()}): ${res.data.percentSaved}% travel distance saved vs baseline.`,
          'success'
        );
      } else if (res.error) {
        showToast(`Optimization failed: ${res.error}`, 'error');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      showToast(`Optimization error: ${msg}`, 'error');
    } finally {
      setOptimizing(false);
    }
  };

  const handleConfirmSchedule = async (
    appId: string,
    inspectorIds: [string, string],
    date: string,
    source?: 'ortools' | 'fallback'
  ) => {
    setSchedulingAppId(appId);
    try {
      const res = await scheduleEvc(appId, inspectorIds, date, source || 'fallback');
      if (res.error) {
        showToast(res.error, 'error');
      } else {
        showToast(`Inspection team scheduled for ${appId} on ${date}. Recorded in audit ledger.`, 'success');
        await loadData();
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      showToast(`Scheduling failed: ${msg}`, 'error');
    } finally {
      setSchedulingAppId(null);
    }
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

      {/* Mode Switcher Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 pb-2">
        <button
          onClick={() => setActiveTab('APPLICATIONS')}
          type="button"
          className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${
            activeTab === 'APPLICATIONS'
              ? 'bg-gov-blue-900 text-white shadow'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <ClipboardCheck className="w-4 h-4 text-gov-saffron" />
          <span>Applications Scrutiny Queue ({applications.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('EVC_OPTIMIZER')}
          type="button"
          className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${
            activeTab === 'EVC_OPTIMIZER'
              ? 'bg-purple-900 text-white shadow'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <Compass className="w-4 h-4 text-purple-400" />
          <span>Schedule Inspections (EVC Vehicle Routing)</span>
          <span className="px-1.5 py-0.5 rounded text-[10px] bg-purple-100 text-purple-900 font-extrabold ml-1">
            OR-Tools VRP
          </span>
        </button>
      </div>

      {activeTab === 'APPLICATIONS' && (
        <>
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
    </>
  )}

  {/* PHASE A: EVC VEHICLE ROUTING OPTIMIZER PANEL */}
  {activeTab === 'EVC_OPTIMIZER' && (
    <div className="space-y-6">
      {/* Controls Card */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Compass className="w-5 h-5 text-purple-700" />
            Google OR-Tools EVC Inspector Scheduling Engine
          </h2>
          <p className="text-xs text-slate-600">
            Solves vehicle routing with time windows (9:00 - 18:00), haversine × 1.3 road distance, 4-hour visit duration, strict domain matching, and pre-solve conflict-of-interest exclusion.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 text-xs">
            <label className="font-semibold text-slate-600">Window:</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs bg-slate-50 font-medium"
            />
            <span className="text-slate-400">to</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs bg-slate-50 font-medium"
            />
          </div>

          <button
            onClick={handleRunOptimizer}
            disabled={optimizing}
            type="button"
            className="px-4 py-2 rounded-lg bg-purple-700 hover:bg-purple-800 text-white text-xs font-bold flex items-center gap-2 shadow-sm transition-colors disabled:opacity-50"
          >
            <Compass className={`w-4 h-4 ${optimizing ? 'animate-spin' : ''}`} />
            <span>{optimizing ? 'Optimizing Routes...' : 'Run EVC Optimizer'}</span>
          </button>
        </div>
      </div>

      {/* When no result yet */}
      {!optimizationResult && (
        <div className="bg-white rounded-xl border border-slate-200 p-8 text-center space-y-4">
          <div className="w-12 h-12 rounded-full bg-purple-50 text-purple-700 flex items-center justify-center mx-auto">
            <Compass className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900">Routing Engine Ready</h3>
            <p className="text-xs text-slate-500 max-w-lg mx-auto mt-1">
              Select an allowed date window and click <strong>Run EVC Optimizer</strong>. The solver will allocate 2-inspector teams to all applications requiring EVC visits without creating conflicts of interest.
            </p>
          </div>
          <div className="flex justify-center gap-4 text-xs font-semibold text-slate-600">
            <span className="px-3 py-1 rounded-full bg-slate-100">12 Seeded Inspectors (4 Domains)</span>
            <span className="px-3 py-1 rounded-full bg-slate-100">10 Seeded Conflict Affiliations</span>
            <span className="px-3 py-1 rounded-full bg-slate-100">Working Hours: 9:00 - 18:00</span>
          </div>
        </div>
      )}

      {/* Optimization Results View */}
      {optimizationResult && (
        <div className="space-y-6">
          {/* Savings KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-purple-50 border border-purple-200 p-5 rounded-xl shadow-sm">
              <div className="flex items-center justify-between text-purple-900 text-xs font-bold">
                <span>Solver Engine</span>
                <span className="px-2 py-0.5 rounded text-[10px] font-extrabold uppercase bg-purple-200 text-purple-900">
                  {optimizationResult.source}
                </span>
              </div>
              <div className="text-2xl font-black text-purple-950 mt-2">
                {optimizationResult.source === 'ortools' ? 'Google OR-Tools' : 'Nearest-Neighbor VRP'}
              </div>
              <p className="text-[11px] text-purple-700 mt-1">Time windows & conflict filters active</p>
            </div>

            <div className="bg-emerald-50 border border-emerald-200 p-5 rounded-xl shadow-sm">
              <div className="flex items-center justify-between text-emerald-900 text-xs font-bold">
                <span>Distance Saved</span>
                <TrendingDown className="w-4 h-4 text-emerald-600" />
              </div>
              <div className="text-2xl font-black text-emerald-950 mt-2">
                {optimizationResult.percentSaved}% Saved
              </div>
              <p className="text-[11px] text-emerald-700 mt-1">
                Optimized {optimizationResult.optimizedKm} km vs {optimizationResult.baselineKm} km baseline
              </p>
            </div>

            <div className="bg-blue-50 border border-blue-200 p-5 rounded-xl shadow-sm">
              <div className="flex items-center justify-between text-blue-900 text-xs font-bold">
                <span>Total Travel Km</span>
                <MapPin className="w-4 h-4 text-blue-600" />
              </div>
              <div className="text-2xl font-black text-blue-950 mt-2">
                {optimizationResult.optimizedKm} km
              </div>
              <p className="text-[11px] text-blue-700 mt-1">Across all deployed inspection teams</p>
            </div>

            <div className="bg-amber-50 border border-amber-200 p-5 rounded-xl shadow-sm">
              <div className="flex items-center justify-between text-amber-900 text-xs font-bold">
                <span>Conflicts Filtered</span>
                <ShieldCheck className="w-4 h-4 text-amber-600" />
              </div>
              <div className="text-2xl font-black text-amber-950 mt-2">
                {optimizationResult.excludedConflictsCount} Excluded
              </div>
              <p className="text-[11px] text-amber-700 mt-1">Strict zero-tolerance affiliation policy</p>
            </div>
          </div>

          {/* Excluded Conflicts of Interest Table */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-4 bg-amber-50/60 border-b border-amber-100 flex items-center justify-between">
              <div className="flex items-center gap-2 text-amber-900 font-bold text-xs uppercase tracking-wider">
                <AlertTriangle className="w-4 h-4 text-amber-600" />
                Conflict of Interest Exclusions ({optimizationResult.excludedConflicts.length})
              </div>
              <span className="text-[11px] text-amber-800 font-medium">
                Filtered prior to solving: Conflicted pairs are mathematically impossible to assign
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase font-bold text-[11px]">
                  <tr>
                    <th className="px-4 py-2.5">Inspector Name</th>
                    <th className="px-4 py-2.5">Affiliated Institution</th>
                    <th className="px-4 py-2.5">Conflict Reason</th>
                    <th className="px-4 py-2.5 text-right">Policy Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {optimizationResult.excludedConflicts.map((c, idx) => (
                    <tr key={idx} className="hover:bg-amber-50/30">
                      <td className="px-4 py-2.5 font-semibold text-slate-900">
                        {c.inspectorName} ({c.inspectorId})
                      </td>
                      <td className="px-4 py-2.5 text-slate-800">{c.institutionName}</td>
                      <td className="px-4 py-2.5 text-amber-900 italic">{c.reason}</td>
                      <td className="px-4 py-2.5 text-right">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-800 border border-red-200">
                          Excluded
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Generated Routes & Action Dispatch */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                <Users className="w-4 h-4 text-purple-700" />
                Optimized Inspector Itineraries & Assigned Teams ({optimizationResult.assignments.length})
              </h3>
              <span className="text-[11px] text-slate-500 font-medium">
                Teams of 2 distinct inspectors per institution
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase font-bold text-[11px]">
                  <tr>
                    <th className="px-4 py-3">Application</th>
                    <th className="px-4 py-3">Scheduled Date</th>
                    <th className="px-4 py-3">Domain</th>
                    <th className="px-4 py-3">Team (2 Distinct Inspectors)</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right">Confirm Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {optimizationResult.assignments.map((asgn) => {
                    const isScheduled = applications.find((a) => a.id === asgn.applicationId)?.scheduledInspection;
                    const isBusy = schedulingAppId === asgn.applicationId;

                    return (
                      <tr key={asgn.id} className="hover:bg-slate-50/70">
                        <td className="px-4 py-3">
                          <span className="font-mono font-bold text-gov-blue-900 block">{asgn.applicationId}</span>
                          <span className="text-slate-800 font-medium">{asgn.institutionName}</span>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap font-medium text-slate-700">
                          <div className="flex items-center gap-1.5">
                            <Calendar className="w-3.5 h-3.5 text-purple-600" />
                            {asgn.scheduledDate}
                          </div>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-50 text-indigo-800 border border-indigo-200">
                            {asgn.domain}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="space-y-1">
                            {asgn.inspectors.map((ins) => (
                              <div key={ins.id} className="flex items-center gap-1.5 text-slate-700">
                                <UserCheck className="w-3.5 h-3.5 text-emerald-600" />
                                <span className="font-semibold">{ins.name}</span>
                                <span className="text-[10px] text-slate-400">({ins.homeCity})</span>
                              </div>
                            ))}
                          </div>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          {isScheduled ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                              Scheduled in Ledger
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                              Proposed Route
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right whitespace-nowrap">
                          <button
                            onClick={() =>
                              handleConfirmSchedule(
                                asgn.applicationId,
                                [asgn.inspectors[0].id, asgn.inspectors[1].id],
                                asgn.scheduledDate,
                                optimizationResult.source
                              )
                            }
                            disabled={isBusy || !!isScheduled}
                            type="button"
                            className="px-3 py-1.5 rounded bg-gov-blue-900 hover:bg-gov-blue-800 text-white font-semibold text-[11px] transition-colors shadow-sm disabled:opacity-50"
                          >
                            {isScheduled ? 'Scheduled ✓' : isBusy ? 'Recording...' : 'Confirm & Schedule'}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Unassigned Visits Panel */}
          {optimizationResult.unassigned.length > 0 && (
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-slate-500" />
                  Unassigned Applications ({optimizationResult.unassigned.length})
                </h3>
              </div>
              <div className="p-4 space-y-2">
                {optimizationResult.unassigned.map((u) => (
                  <div
                    key={u.applicationId}
                    className="p-3 rounded-lg bg-slate-50 border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                  >
                    <div>
                      <span className="font-mono font-bold text-gov-blue-900 mr-2">{u.applicationId}</span>
                      <span className="font-semibold text-slate-800">{u.institutionName}</span>
                    </div>
                    <span className="text-red-700 bg-red-50 border border-red-200 px-2 py-0.5 rounded text-[11px] font-medium">
                      {u.reason}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )}

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
