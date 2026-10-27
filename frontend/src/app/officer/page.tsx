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
  Undo2,
  FileText,
  Building2,
} from 'lucide-react';
import {
  Application,
  ApplicationType,
  OptimizationResult,
  ReturnCategory,
  SignoffDecision,
  Status,
  VerificationQueueData,
  InstitutionProfile,
  RiskEvaluationResult,
} from '../../lib/types';
import {
  getApplications,
  runExtract,
  advanceApplication,
  returnApplication,
  recordSignoff,
  optimizeScheduling,
  scheduleEvc,
  getVerificationQueue,
  verifyUndertaking,
  verifyRenewal,
  getOfficerProfiles,
  getOfficerProfileRisk,
  reviewOfficerProfile,
} from '../../lib/api';
import { StatusBadge } from '../../components/StatusBadge';
import { SlaBadge } from '../../components/SlaBadge';
import { RouteSequence } from '../../components/RouteSequence';
import { DeficiencyList } from '../../components/DeficiencyList';
import { SafeguardNotice } from '../../components/SafeguardNotice';
import { formatDate, shortHash } from '../../lib/utils';

const NEXT_STATE_TRANSITIONS: Record<Status, Status[]> = {
  SUBMITTED: ['SCRUTINY', 'EVC_REQUIRED'],
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
  const [loadError, setLoadError] = useState<string | null>(null);
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

  // Part 2: return/revert modal
  const [returningApp, setReturningApp] = useState<Application | null>(null);
  const [returnTarget, setReturnTarget] = useState<Status | ''>('');
  const [returnCategory, setReturnCategory] = useState<ReturnCategory>('DEFICIENCY');
  const [returnReason, setReturnReason] = useState('');
  const [returnSubmitting, setReturnSubmitting] = useState(false);

  // Phase A & D/E: Tab state
  const [activeTab, setActiveTab] = useState<'APPLICATIONS' | 'EVC_OPTIMIZER' | 'VERIFICATION_QUEUE' | 'PROFILE_REVIEWS'>('APPLICATIONS');
  const [startDate, setStartDate] = useState('2026-11-01');
  const [endDate, setEndDate] = useState('2026-11-07');
  const [optimizing, setOptimizing] = useState(false);
  const [optimizationResult, setOptimizationResult] = useState<OptimizationResult | null>(null);
  const [schedulingAppId, setSchedulingAppId] = useState<string | null>(null);

  // Part 4: Verification Queue state
  const [queueData, setQueueData] = useState<VerificationQueueData>({ undertakings: [], renewals: [] });
  const [queueLoading, setQueueLoading] = useState(false);
  const [verifyingId, setVerifyingId] = useState<string | null>(null);

  // R1: Profile Reviews & Document Risk State
  const [profileList, setProfileList] = useState<InstitutionProfile[]>([]);
  const [loadingProfiles, setLoadingProfiles] = useState(false);
  const [riskModalProfile, setRiskModalProfile] = useState<InstitutionProfile | null>(null);
  const [riskResult, setRiskResult] = useState<RiskEvaluationResult | null>(null);
  const [loadingRisk, setLoadingRisk] = useState(false);
  const [reviewDecision, setReviewDecision] = useState<'NO_CONCERN' | 'ASK_CLARIFICATION' | 'REFER'>('NO_CONCERN');
  const [reviewRemarks, setReviewRemarks] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);

  // Reject modal state
  const [rejectModal, setRejectModal] = useState<{
    type: 'UNDERTAKING' | 'RENEWAL';
    id: string;
    label: string;
    institutionName?: string;
  } | null>(null);
  const [rejectRemarks, setRejectRemarks] = useState('');
  const [rejectSubmitting, setRejectSubmitting] = useState(false);

  const loadData = async () => {
    setLoading(true);
    setLoadError(null);
    const filters: { status?: Status; type?: ApplicationType } = {};
    if (statusFilter !== 'ALL') filters.status = statusFilter as Status;
    if (typeFilter !== 'ALL') filters.type = typeFilter as ApplicationType;

    try {
      const res = await getApplications(filters);
      setApplications(res.data || []);
    } catch (err) {
      setApplications([]);
      setLoadError(
        err instanceof Error ? err.message : 'Unable to load the review queue.'
      );
    } finally {
      setLoading(false);
    }
  };

  const loadQueue = async () => {
    setQueueLoading(true);
    try {
      const res = await getVerificationQueue();
      setQueueData(res.data || { undertakings: [], renewals: [] });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      showToast(`Failed to load verification queue: ${msg}`, 'error');
    } finally {
      setQueueLoading(false);
    }
  };

  const loadProfiles = async () => {
    setLoadingProfiles(true);
    try {
      const res = await getOfficerProfiles();
      setProfileList(res.data || []);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      showToast(`Failed to load profile reviews: ${msg}`, 'error');
    } finally {
      setLoadingProfiles(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'VERIFICATION_QUEUE') {
      loadQueue();
    } else if (activeTab === 'PROFILE_REVIEWS') {
      loadProfiles();
    }
  }, [activeTab]);

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

  const handleOpenRisk = async (prof: InstitutionProfile) => {
    setRiskModalProfile(prof);
    setLoadingRisk(true);
    setRiskResult(null);
    setReviewRemarks('');
    setReviewDecision('NO_CONCERN');
    try {
      const res = await getOfficerProfileRisk(prof.id);
      if (res.data) setRiskResult(res.data);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      showToast(`Risk check failed: ${msg}`, 'error');
    } finally {
      setLoadingRisk(false);
    }
  };

  const handleSubmitReview = async () => {
    if (!riskModalProfile) return;
    if (!reviewRemarks.trim()) {
      showToast('Mandatory remarks are required for recording an officer review.', 'error');
      return;
    }
    setSubmittingReview(true);
    try {
      const res = await reviewOfficerProfile(riskModalProfile.id, reviewDecision, reviewRemarks.trim());
      if (res.error) {
        showToast(res.error, 'error');
        return;
      }
      showToast(`Officer review (${reviewDecision}) recorded with ledger proof.`, 'success');
      setRiskModalProfile(null);
      await loadProfiles();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      showToast(`Failed to record review: ${msg}`, 'error');
    } finally {
      setSubmittingReview(false);
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
    const validNext = app.route?.nextStatuses ?? NEXT_STATE_TRANSITIONS[app.status] ?? [];
    setSelectedNextStatus(validNext[0] || '');
    setAdvanceRemarks('');
    setOverrideRemarks('');
  };

  const handleConfirmAdvance = async (useAuto = false) => {
    if (!advancingApp) return;
    const target = useAuto ? advancingApp.route?.autoNextStatus : (selectedNextStatus as Status);
    if (!target) return;

    setActionLoadingId(advancingApp.id);
    try {
      await advanceApplication(
        advancingApp.id,
        useAuto ? undefined : target,
        advanceRemarks,
        overrideRemarks
      );
      showToast(`Successfully advanced ${advancingApp.id} to ${target}`, 'success');
      setAdvancingApp(null);
      await loadData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      showToast(msg, 'error');
    } finally {
      setActionLoadingId(null);
    }
  };

  const openReturnDialog = (app: Application) => {
    setReturningApp(app);
    setReturnTarget(app.route?.returnTargets[0] || '');
    setReturnCategory('DEFICIENCY');
    setReturnReason('');
  };

  const handleConfirmReturn = async () => {
    if (!returningApp || !returnTarget || !returnReason.trim()) {
      showToast('A target stage and recorded reason are required for a return.', 'error');
      return;
    }

    setReturnSubmitting(true);
    try {
      const res = await returnApplication(returningApp.id, {
        to: returnTarget as Status,
        category: returnCategory,
        reason: returnReason.trim(),
      });
      showToast(
        `Return recorded: ${returningApp.id} moved to ${res.data.return.toStatus}. Standard notice issued.`,
        'warning'
      );
      setReturningApp(null);
      await loadData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      showToast(`Return failed: ${msg}`, 'error');
    } finally {
      setReturnSubmitting(false);
    }
  };

  const handleVerifyUndertaking = async (undertakingId: string, decision: 'VERIFIED' | 'REJECTED', remarks?: string) => {
    setVerifyingId(undertakingId);
    try {
      const res = await verifyUndertaking(
        undertakingId,
        decision,
        remarks || (decision === 'VERIFIED' ? 'Verified by scrutiny officer' : '')
      );
      if (res.data?.success) {
        showToast(
          decision === 'VERIFIED'
            ? 'Undertaking evidence verified and closed on ledger.'
            : 'Undertaking evidence rejected and logged to ledger.',
          'success'
        );
        await Promise.all([loadQueue(), loadData()]);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      showToast(msg, 'error');
    } finally {
      setVerifyingId(null);
    }
  };

  const handleVerifyRenewal = async (complianceDocId: string, decision: 'VERIFIED' | 'REJECTED', remarks?: string) => {
    setVerifyingId(complianceDocId);
    try {
      const res = await verifyRenewal(
        complianceDocId,
        decision,
        remarks || (decision === 'VERIFIED' ? 'Statutory document renewal verified by regional officer' : '')
      );
      if (res.data?.success) {
        const unlockMsg = res.data.unlocked ? ' Application compliance lock released!' : '';
        showToast(
          decision === 'VERIFIED'
            ? `Document validity renewed successfully.${unlockMsg}`
            : 'Document renewal rejected and logged to ledger.',
          'success'
        );
        await Promise.all([loadQueue(), loadData()]);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      showToast(msg, 'error');
    } finally {
      setVerifyingId(null);
    }
  };

  const handleConfirmReject = async () => {
    if (!rejectModal) return;
    if (!rejectRemarks.trim()) {
      showToast('Remarks are mandatory when rejecting compliance evidence.', 'error');
      return;
    }
    setRejectSubmitting(true);
    try {
      if (rejectModal.type === 'UNDERTAKING') {
        await verifyUndertaking(rejectModal.id, 'REJECTED', rejectRemarks.trim());
        showToast(`Undertaking ${rejectModal.id} rejected and recorded to audit ledger.`, 'success');
      } else {
        await verifyRenewal(rejectModal.id, 'REJECTED', rejectRemarks.trim());
        showToast(`Document renewal ${rejectModal.id} rejected and recorded to audit ledger.`, 'success');
      }
      setRejectModal(null);
      setRejectRemarks('');
      await Promise.all([loadQueue(), loadData()]);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      showToast(`Rejection refused: ${msg}`, 'error');
    } finally {
      setRejectSubmitting(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">

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

      {loadError && (
        <div className="p-4 rounded-xl border border-red-200 bg-red-50 text-red-800 text-xs">
          <strong>Could not load data:</strong> {loadError}
        </div>
      )}

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

        <button
          onClick={() => setActiveTab('VERIFICATION_QUEUE')}
          type="button"
          className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${
            activeTab === 'VERIFICATION_QUEUE'
              ? 'bg-emerald-900 text-white shadow'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          <span>Verification Queue</span>
          <span className="px-1.5 py-0.5 rounded text-[10px] bg-emerald-100 text-emerald-900 font-extrabold ml-1">
            {queueData.undertakings.length + queueData.renewals.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('PROFILE_REVIEWS')}
          type="button"
          className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${
            activeTab === 'PROFILE_REVIEWS'
              ? 'bg-amber-900 text-white shadow'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <Building2 className="w-4 h-4 text-gov-gold" />
          <span>Profile Reviews & Document Risk</span>
          <span className="px-1.5 py-0.5 rounded text-[10px] bg-amber-100 text-amber-900 font-extrabold ml-1">
            {profileList.length}
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
            <option value="APPEAL">Appeal / SAC-SHC Review</option>
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
                  const validNext = app.route?.nextStatuses ?? NEXT_STATE_TRANSITIONS[app.status] ?? [];
                  const returnTargets = app.route?.returnTargets ?? [];
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
                        {app.route && (
                          <div className="text-[10px] text-slate-400 mt-0.5">
                            {app.route.name} · stage {app.route.currentStage}
                          </div>
                        )}
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

                          {/* Read-only electronic case summary */}
                          <Link
                            href={`/case/${app.id}`}
                            className="px-2 py-1.5 rounded bg-white hover:bg-slate-100 text-slate-600 font-semibold text-[11px] border border-slate-200 transition-colors flex items-center gap-1"
                            title="Open read-only electronic case summary"
                          >
                            <FileText className="w-3 h-3" />
                            <span>Case</span>
                          </Link>

                          {/* Return / revert with reason and category */}
                          {returnTargets.length > 0 && (
                            <button
                              onClick={() => openReturnDialog(app)}
                              disabled={isActionBusy}
                              type="button"
                              className="px-2.5 py-1.5 rounded bg-amber-50 hover:bg-amber-100 text-amber-800 font-semibold border border-amber-200 text-[11px] transition-colors flex items-center gap-1 disabled:opacity-50"
                              title="Return or revert with a recorded category and reason"
                            >
                              <Undo2 className="w-3 h-3" />
                              <span>Return</span>
                            </button>
                          )}

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

  {/* PART 4: REGIONAL VERIFICATION QUEUE PANEL */}
  {activeTab === 'VERIFICATION_QUEUE' && (
    <div className="space-y-6">
      {/* Top Banner & Safeguard */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="space-y-1">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-emerald-600" />
              Regional Evidence & Renewals Verification Queue
            </h2>
            <p className="text-xs text-slate-600">
              Scrutinize submitted undertaking proofs and renewed statutory documents. Verifications are immutably logged to the ledger.
            </p>
          </div>
          <button
            onClick={loadQueue}
            type="button"
            className="self-start sm:self-auto px-3.5 py-2 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold flex items-center gap-2 shadow-sm transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${queueLoading ? 'animate-spin' : ''}`} />
            <span>Refresh Verification Queue</span>
          </button>
        </div>

        {/* Visible Safeguard Notice */}
        <SafeguardNotice />
      </div>

      {/* SECTION 1: Undertakings Queue */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ClipboardCheck className="w-4 h-4 text-gov-blue-800" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
              Conditional Undertakings Evidence Queue ({queueData.undertakings.length})
            </h3>
          </div>
          <span className="text-[11px] text-slate-500">
            Scoped by officer role & regional jurisdiction
          </span>
        </div>

        {queueData.undertakings.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-400">
            No pending undertaking evidence submissions in your regional queue.
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {queueData.undertakings.map((u) => {
              const latestEvidence = u.evidence && u.evidence.length > 0 ? u.evidence[u.evidence.length - 1] : null;
              const isProcessing = verifyingId === u.id;
              const isOverdue = u.status === 'OVERDUE';

              return (
                <div key={u.id} className="p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4 hover:bg-slate-50/50">
                  <div className="space-y-2 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs font-bold text-gov-blue-900 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                        {u.applicationId}
                      </span>
                      <span className="font-mono text-xs text-slate-500">
                        {u.id}
                      </span>
                      <span className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded ${
                        isOverdue ? 'bg-red-600 text-white' : 'bg-blue-600 text-white'
                      }`}>
                        {u.status}
                      </span>
                      <span className="text-xs text-slate-500 font-medium">
                        Due: {formatDate(u.dueDate)}
                      </span>
                    </div>

                    <p className="text-xs font-semibold text-slate-800">
                      Condition: {u.conditionText}
                    </p>

                    {latestEvidence && (
                      <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 text-xs flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <FileCheck2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                          <span className="font-medium text-slate-800">{latestEvidence.fileName}</span>
                          <span className="text-[10px] text-slate-400">
                            by {latestEvidence.submittedBy} on {formatDate(latestEvidence.submittedAt)}
                          </span>
                        </div>
                        <span className="font-mono text-[10px] bg-white px-2 py-0.5 rounded border border-slate-200 text-slate-600" title={latestEvidence.fileHash}>
                          SHA-256: {shortHash(latestEvidence.fileHash, 8)}
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0 self-end lg:self-center">
                    <button
                      type="button"
                      disabled={isProcessing}
                      onClick={() => handleVerifyUndertaking(u.id, 'VERIFIED')}
                      className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg shadow-sm flex items-center gap-1.5 transition-colors disabled:opacity-50"
                    >
                      {isProcessing ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <CheckCheck className="w-3.5 h-3.5" />}
                      <span>Verify Evidence</span>
                    </button>
                    <button
                      type="button"
                      disabled={isProcessing}
                      onClick={() => {
                        setRejectModal({
                          type: 'UNDERTAKING',
                          id: u.id,
                          label: u.conditionText,
                        });
                        setRejectRemarks('');
                      }}
                      className="px-3.5 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold rounded-lg flex items-center gap-1.5 transition-colors"
                    >
                      <XCircle className="w-3.5 h-3.5" />
                      <span>Reject</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* SECTION 2: Document Renewals Queue */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <RefreshCw className="w-4 h-4 text-purple-700" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
              Statutory Document Renewals Queue ({queueData.renewals.length})
            </h3>
          </div>
          <span className="text-[11px] text-slate-500">
            Verified renewals extend validity and automatically unlock applications
          </span>
        </div>

        {queueData.renewals.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-400">
            No pending document renewals in your regional queue.
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {queueData.renewals.map((r) => {
              const isProcessing = verifyingId === r.id;
              const ev = r.renewalEvidence;

              return (
                <div key={r.id} className="p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4 hover:bg-slate-50/50">
                  <div className="space-y-2 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs font-bold text-gov-blue-900 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                        {r.applicationId}
                      </span>
                      <span className="font-bold text-xs uppercase px-2 py-0.5 rounded bg-purple-100 text-purple-900">
                        {r.docType.replace(/_/g, ' ')}
                      </span>
                      <span className="text-xs text-slate-500 font-medium">
                        Current Expiry: <strong className="text-slate-800">{r.expiryDate}</strong>
                      </span>
                      <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded bg-amber-100 text-amber-800">
                        {r.state}
                      </span>
                    </div>

                    {ev && (
                      <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 text-xs flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <FileCheck2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                          <span className="font-medium text-slate-800">{ev.fileName}</span>
                          <span className="text-[10px] text-slate-400">
                            by {ev.submittedBy} on {formatDate(ev.submittedAt)}
                          </span>
                        </div>
                        <span className="font-mono text-[10px] bg-white px-2 py-0.5 rounded border border-slate-200 text-slate-600" title={ev.fileHash}>
                          SHA-256: {shortHash(ev.fileHash, 8)}
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0 self-end lg:self-center">
                    <button
                      type="button"
                      disabled={isProcessing}
                      onClick={() => handleVerifyRenewal(r.id, 'VERIFIED')}
                      className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg shadow-sm flex items-center gap-1.5 transition-colors disabled:opacity-50"
                    >
                      {isProcessing ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <CheckCheck className="w-3.5 h-3.5" />}
                      <span>Verify Renewal & Unlock</span>
                    </button>
                    <button
                      type="button"
                      disabled={isProcessing}
                      onClick={() => {
                        setRejectModal({
                          type: 'RENEWAL',
                          id: r.id,
                          label: `${r.docType.replace(/_/g, ' ')} renewal for ${r.applicationId}`,
                        });
                        setRejectRemarks('');
                      }}
                      className="px-3.5 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold rounded-lg flex items-center gap-1.5 transition-colors"
                    >
                      <XCircle className="w-3.5 h-3.5" />
                      <span>Reject</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  )}

  {activeTab === 'PROFILE_REVIEWS' && (
    <div className="space-y-6">
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2 text-gov-blue-900 font-bold text-lg">
              <Building2 className="w-5 h-5 text-gov-saffron" />
              Regional Institution Profiles & Risk Queue
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Review submitted technical institution statutory profiles, examine multi-signal document risk indicators, and record formal review determinations.
            </p>
          </div>
          <button
            onClick={loadProfiles}
            type="button"
            className="self-start sm:self-auto px-3.5 py-2 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold flex items-center gap-2 shadow-sm transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loadingProfiles ? 'animate-spin' : ''}`} />
            <span>Refresh Profiles</span>
          </button>
        </div>

        {loadingProfiles ? (
          <div className="py-12 flex flex-col items-center justify-center text-slate-500 gap-2">
            <RefreshCw className="w-6 h-6 animate-spin text-gov-saffron" />
            <span className="text-xs font-semibold">Loading institutional profiles for your region...</span>
          </div>
        ) : profileList.length === 0 ? (
          <div className="py-12 text-center text-slate-500 bg-slate-50 rounded-xl border border-dashed border-slate-200 space-y-2">
            <Building2 className="w-8 h-8 mx-auto text-slate-400" />
            <p className="text-xs font-semibold">No institutional profiles awaiting review in your region.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {profileList.map((prof) => (
              <div
                key={prof.id}
                className="p-5 rounded-xl border border-slate-200 bg-white hover:border-slate-300 transition-all shadow-xs flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4"
              >
                <div className="space-y-2 min-w-0">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <span className="font-bold text-sm text-slate-900">
                      {prof.college?.name || prof.institutionName}
                    </span>
                    <span
                      className={`px-2.5 py-0.5 rounded text-[10px] font-extrabold uppercase ${
                        prof.status === 'VERIFIED'
                          ? 'bg-emerald-100 text-emerald-800'
                          : prof.status === 'SUBMITTED' || prof.status === 'UNDER_REVIEW'
                          ? 'bg-blue-100 text-blue-800'
                          : prof.status === 'DEFICIENT'
                          ? 'bg-rose-100 text-rose-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {prof.status}
                    </span>
                    <span className="text-xs text-slate-400">·</span>
                    <span className="text-xs text-slate-600">
                      {prof.college?.district ? `${prof.college.district}, ` : ''}{prof.state || prof.college?.state}
                    </span>
                    <span className="text-xs text-slate-400">·</span>
                    <span className="text-xs font-semibold text-gov-blue-800">
                      Region: {prof.region}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs text-slate-600 pt-1">
                    <div>
                      <span className="font-bold text-slate-700">Trust:</span>{' '}
                      {prof.trust?.name || 'N/A'}
                    </div>
                    <div>
                      <span className="font-bold text-slate-700">Bank Encrypted:</span>{' '}
                      <span className="font-mono text-emerald-700">
                        {prof.bank?.maskedAccountNumber || 'AES-256 Secured'}
                      </span>
                    </div>
                    <div>
                      <span className="font-bold text-slate-700">Land:</span>{' '}
                      {prof.land?.landType || 'OWNED'} ({prof.land?.totalAreaSqm || 0} sqm)
                    </div>
                  </div>

                  {prof.flaggedItems && prof.flaggedItems.length > 0 && (
                    <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
                      <span className="text-amber-800 font-bold flex items-center gap-1">
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                        {prof.flaggedItems.length} automated check flag(s):
                      </span>
                      {prof.flaggedItems.slice(0, 2).map((flag, idx) => (
                        <span
                          key={idx}
                          className="bg-amber-50 border border-amber-200 px-2 py-0.5 rounded text-[11px] text-amber-800"
                        >
                          {flag.item}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <div className="shrink-0 flex items-center gap-2 self-end lg:self-center">
                  <button
                    type="button"
                    onClick={() => handleOpenRisk(prof)}
                    className="px-4 py-2.5 rounded-lg bg-gov-blue-900 hover:bg-gov-blue-800 text-white font-semibold text-xs flex items-center gap-2 shadow-sm transition-all"
                  >
                    <ShieldCheck className="w-4 h-4 text-gov-gold" />
                    <span>Check document risk</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
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
                {reviewApp.route && (
                  <p className="text-[11px] text-blue-200 mt-0.5">
                    {reviewApp.route.name} · stage {reviewApp.route.currentStage}
                  </p>
                )}
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

              <SafeguardNotice compact />

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

            <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
              <Link
                href={`/case/${reviewApp.id}`}
                className="text-xs font-bold text-gov-blue-900 hover:underline flex items-center gap-1"
              >
                <FileText className="w-4 h-4" />
                <span>Open read-only case summary</span>
              </Link>
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

            <SafeguardNotice compact />

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
                  Current Status
                </label>
                <StatusBadge status={advancingApp.status} size="md" />
                {advancingApp.route && (
                  <p className="text-[11px] text-slate-500 mt-1">
                    {advancingApp.route.name} � stage {advancingApp.route.currentStage}
                    {advancingApp.route.autoNextStatus
                      ? ` � configured next: ${advancingApp.route.autoNextStatus}`
                      : ' � no automatic next stage'}
                  </p>
                )}
              </div>

              <RouteSequence route={advancingApp.route} compact />

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Target Next Status *
                </label>
                <select
                  value={selectedNextStatus}
                  onChange={(e) => setSelectedNextStatus(e.target.value as Status)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white font-semibold"
                >
                  {(advancingApp.route?.nextStatuses ??
                    NEXT_STATE_TRANSITIONS[advancingApp.status] ??
                    []
                  ).map((target) => {
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
              {advancingApp.route?.autoNextStatus && (
                <button
                  type="button"
                  onClick={() => handleConfirmAdvance(true)}
                  disabled={actionLoadingId === advancingApp.id}
                  className="px-4 py-2 text-xs font-bold text-gov-blue-900 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg disabled:opacity-50"
                  title={`Use configured automatic next stage: ${advancingApp.route.autoNextStatus}`}
                >
                  Auto: {advancingApp.route.autoNextStatus}
                </button>
              )}
              <button
                type="button"
                onClick={() => handleConfirmAdvance()}
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

      {/* Part 2: return / revert modal */}
      {returningApp && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full border border-slate-200 shadow-2xl p-6 space-y-4">
            <div className="border-b border-slate-200 pb-3 flex items-start justify-between gap-3">
              <div>
                <span className="font-mono text-xs font-bold text-amber-800 bg-amber-50 px-2 py-0.5 rounded">
                  {returningApp.id}
                </span>
                <h2 className="text-base font-bold text-slate-900 mt-1 flex items-center gap-1.5">
                  <Undo2 className="w-4 h-4 text-amber-700" />
                  Return / Revert Application
                </h2>
                <p className="text-xs text-slate-500">
                  Returns are permitted only to configured earlier stages and are recorded with a
                  category and reason.
                </p>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">From</p>
                <StatusBadge status={returningApp.status} size="md" />
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Return Target Stage *
                </label>
                <select
                  value={returnTarget}
                  onChange={(e) => setReturnTarget(e.target.value as Status)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white font-semibold"
                >
                  {(returningApp.route?.returnTargets ?? []).map((target) => (
                    <option key={target} value={target}>
                      {target}
                    </option>
                  ))}
                </select>
                <p className="text-[10px] text-slate-400 mt-1">
                  Configured targets:{' '}
                  {(returningApp.route?.returnTargets ?? []).join(', ') || 'none'}
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Return Category *
                </label>
                <select
                  value={returnCategory}
                  onChange={(e) => setReturnCategory(e.target.value as ReturnCategory)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white font-semibold"
                >
                  {(returningApp.route?.returnCategories ?? []).map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Recorded Reason * (minimum 10 characters)
                </label>
                <textarea
                  rows={3}
                  placeholder="Explain the specific deficiency, missing information or clarification required..."
                  value={returnReason}
                  onChange={(e) => setReturnReason(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                />
                <p className="text-[10px] text-slate-400 mt-1 text-right">
                  {returnReason.trim().length} characters
                </p>
              </div>
            </div>

            <SafeguardNotice compact />

            <div className="pt-3 border-t border-slate-200 flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => setReturningApp(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmReturn}
                disabled={
                  returnSubmitting ||
                  !returnTarget ||
                  returnReason.trim().length < 10 ||
                  !returnCategory
                }
                className="px-5 py-2 text-xs font-bold text-white bg-amber-700 hover:bg-amber-800 rounded-lg shadow-sm disabled:opacity-50 flex items-center gap-1.5"
              >
                {returnSubmitting && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                <span>Record Return & Issue Notice</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* REJECT EVIDENCE / RENEWAL MODAL */}
      {rejectModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full border border-slate-200 shadow-2xl p-6 space-y-4">
            <div className="border-b border-slate-200 pb-3 flex items-center justify-between">
              <div>
                <span className="font-mono text-xs font-bold text-red-700 bg-red-50 px-2 py-0.5 rounded border border-red-200">
                  REJECTION SAFEGUARD
                </span>
                <h2 className="text-base font-bold text-slate-900 mt-1">
                  Reject {rejectModal.type === 'UNDERTAKING' ? 'Undertaking Evidence' : 'Document Renewal'}
                </h2>
              </div>
              <button
                onClick={() => setRejectModal(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <SafeguardNotice compact />

            <div className="p-3 bg-slate-50 rounded-lg text-xs space-y-1 border border-slate-200">
              <span className="font-bold text-slate-700 uppercase text-[10px]">Target Record:</span>
              <p className="font-mono text-xs text-gov-blue-900 font-bold">{rejectModal.id}</p>
              <p className="text-slate-600 text-[11px]">{rejectModal.label}</p>
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-bold text-slate-700 uppercase">
                Rejection Remarks *
              </label>
              <textarea
                rows={3}
                value={rejectRemarks}
                onChange={(e) => setRejectRemarks(e.target.value)}
                placeholder="State specific deficiencies or legal discrepancies in the submitted evidence..."
                className="w-full text-xs p-3 rounded-lg border border-slate-200 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-red-500 focus:outline-none"
              />
              <p className="text-[10px] text-slate-500">
                AICTE Safeguard Notice: Rejections require a confirmed officer sign-off on the application. Rejections are immutably posted to the SHA-256 audit ledger.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setRejectModal(null)}
                className="px-4 py-2 rounded-lg bg-slate-100 text-slate-700 text-xs font-semibold hover:bg-slate-200"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={rejectSubmitting || !rejectRemarks.trim()}
                onClick={handleConfirmReject}
                className="px-4 py-2 rounded-lg bg-red-600 text-white text-xs font-bold hover:bg-red-700 disabled:opacity-50 flex items-center gap-1.5 shadow-sm"
              >
                {rejectSubmitting && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                <span>Confirm Rejection</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* R1: DOCUMENT RISK SCORE & REGIONAL OFFICER DETERMINATION MODAL */}
      {riskModalProfile && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full border border-slate-200 shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
            {/* Modal Header */}
            <div className="p-5 bg-gov-blue-900 text-white border-b-4 border-gov-saffron flex items-center justify-between">
              <div>
                <span className="font-mono text-xs font-bold bg-white/20 px-2 py-0.5 rounded text-white">
                  {riskModalProfile.id}
                </span>
                <h2 className="text-base font-bold mt-1">
                  Document Risk Assessment · {riskModalProfile.college?.name || riskModalProfile.institutionName}
                </h2>
                <p className="text-[11px] text-blue-200 mt-0.5">
                  Region: {riskModalProfile.region} · State: {riskModalProfile.state || riskModalProfile.college?.state}
                </p>
              </div>
              <button
                onClick={() => setRiskModalProfile(null)}
                className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-5 overflow-y-auto flex-1">
              {loadingRisk ? (
                <div className="py-12 flex flex-col items-center justify-center text-slate-500 gap-2">
                  <RefreshCw className="w-6 h-6 animate-spin text-gov-saffron" />
                  <span className="text-xs font-semibold">
                    Evaluating multi-signal document heuristics (hash duplication, software signatures, declared vs extracted data)...
                  </span>
                </div>
              ) : riskResult ? (
                <>
                  {/* Score & Level Display */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-between">
                      <div>
                        <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                          Composite Document Risk
                        </span>
                        <div className="text-3xl font-extrabold text-slate-900 mt-1">
                          {riskResult.score} <span className="text-sm font-normal text-slate-500">/ 100</span>
                        </div>
                      </div>
                      <div
                        className={`w-14 h-14 rounded-full flex items-center justify-center font-bold text-lg shadow-sm ${
                          riskResult.level === 'HIGH'
                            ? 'bg-rose-100 text-rose-700 border-2 border-rose-300'
                            : riskResult.level === 'MEDIUM'
                            ? 'bg-amber-100 text-amber-700 border-2 border-amber-300'
                            : 'bg-emerald-100 text-emerald-700 border-2 border-emerald-300'
                        }`}
                      >
                        {riskResult.score}
                      </div>
                    </div>

                    <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 flex flex-col justify-center">
                      <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                        Risk Level
                      </span>
                      <div className="mt-1 flex items-center gap-2">
                        <span
                          className={`px-3 py-1 rounded text-xs font-extrabold uppercase tracking-wider ${
                            riskResult.level === 'HIGH'
                              ? 'bg-rose-600 text-white'
                              : riskResult.level === 'MEDIUM'
                              ? 'bg-amber-500 text-white'
                              : 'bg-emerald-600 text-white'
                          }`}
                        >
                          {riskResult.level} RISK
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Mandatory Statutory Disclaimer Banner */}
                  <div className="bg-amber-50 border border-amber-300 rounded-xl p-4 flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                    <div className="space-y-1">
                      <span className="text-xs font-extrabold text-amber-900 uppercase tracking-wide">
                        Statutory Regulatory Disclaimer
                      </span>
                      <p className="text-xs text-amber-800 leading-relaxed">
                        <strong>{riskResult.disclaimer || 'risk indicators, not proof'}:</strong> Risk scores and signals represent automated heuristic indicators for scrutiny officer guidance. <em>System never auto-rejects or blocks applications based on risk indicators.</em> Formal regulatory decisions must be recorded by the regional officer.
                      </p>
                    </div>
                  </div>

                  {/* Signals List */}
                  <div className="space-y-2">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                      <ShieldCheck className="w-4 h-4 text-gov-blue-800" />
                      Detected Risk Signals ({riskResult.signals.length})
                    </h3>

                    {riskResult.signals.length === 0 ? (
                      <div className="p-4 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-center gap-2">
                        <CheckCircle className="w-4 h-4 text-emerald-600" />
                        <span>No anomalies or risk signals detected in the submitted statutory documents.</span>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {riskResult.signals.map((sig, idx) => (
                          <div
                            key={idx}
                            className="p-3 rounded-lg border border-slate-200 bg-white space-y-1.5 shadow-xs"
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-xs text-slate-900">
                                {sig.type.replace(/_/g, ' ')}
                              </span>
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                  sig.severity === 'HIGH'
                                    ? 'bg-rose-100 text-rose-700'
                                    : sig.severity === 'MEDIUM'
                                    ? 'bg-amber-100 text-amber-700'
                                    : 'bg-blue-100 text-blue-700'
                                }`}
                              >
                                {sig.severity} (+{sig.score} pts)
                              </span>
                            </div>
                            <p className="text-xs text-slate-600">{sig.description}</p>
                            {sig.evidence && Object.keys(sig.evidence).length > 0 && (
                              <pre className="text-[10px] font-mono bg-slate-50 p-2 rounded border border-slate-100 text-slate-700 overflow-x-auto">
                                {JSON.stringify(sig.evidence, null, 2)}
                              </pre>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Officer Review Decision Form */}
                  <div className="space-y-3 pt-3 border-t border-slate-200">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                      Officer Determination & Regulatory Action
                    </h3>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700">
                        Determination Decision *
                      </label>
                      <select
                        value={reviewDecision}
                        onChange={(e) => setReviewDecision(e.target.value as any)}
                        className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold bg-white focus:ring-2 focus:ring-gov-blue-700/30"
                      >
                        <option value="NO_CONCERN">NO CONCERN — Documents and profile verified satisfactory</option>
                        <option value="ASK_CLARIFICATION">ASK CLARIFICATION — Request clarification / corrected deed</option>
                        <option value="REFER">REFER — Refer to Regional Scrutiny Hearing / EVC inspection</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700">
                        Officer Remarks * (Required for audit proof)
                      </label>
                      <textarea
                        rows={3}
                        value={reviewRemarks}
                        onChange={(e) => setReviewRemarks(e.target.value)}
                        placeholder="State detailed findings, verified deed dates, land record confirmation, or reason for clarification..."
                        className="mt-1 w-full rounded-lg border border-slate-300 p-2.5 text-xs focus:ring-2 focus:ring-gov-blue-700/30"
                      />
                    </div>

                    <p className="text-[10px] text-slate-500 bg-slate-50 p-2 rounded border border-slate-200">
                      <strong>Audit Trail Guarantee:</strong> Submitting this determination permanently records the decision in the AICTE cryptographic audit ledger (IDs only; no sensitive personal details).
                    </p>
                  </div>
                </>
              ) : null}
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setRiskModalProfile(null)}
                className="px-4 py-2 rounded-lg bg-white border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Close
              </button>
              <button
                type="button"
                disabled={submittingReview || loadingRisk || !reviewRemarks.trim()}
                onClick={handleSubmitReview}
                className="px-5 py-2 rounded-lg bg-gov-blue-900 hover:bg-gov-blue-800 text-white text-xs font-bold transition-all shadow-md disabled:opacity-50 flex items-center gap-1.5"
              >
                {submittingReview && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                <span>Record Determination</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
