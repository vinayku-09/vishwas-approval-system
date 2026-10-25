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
  FileSearch,
} from 'lucide-react';
import { Application, ApplicationType, Status } from '../../lib/types';
import { getApplications, runScrutiny, advanceApplication } from '../../lib/api';
import { StatusBadge } from '../../components/StatusBadge';
import { SlaBadge } from '../../components/SlaBadge';
import { DemoBanner } from '../../components/DemoBanner';
import { formatDate } from '../../lib/utils';

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
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [typeFilter, setTypeFilter] = useState<string>('ALL');

  // Advance modal
  const [advancingApp, setAdvancingApp] = useState<Application | null>(null);
  const [selectedNextStatus, setSelectedNextStatus] = useState<Status | ''>('');
  const [advanceRemarks, setAdvanceRemarks] = useState('');

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

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  const handleRunScrutiny = async (app: Application) => {
    setActionLoadingId(app.id);
    try {
      const res = await runScrutiny(app.id, app.extracted);
      const newStatus = res.data.application.status;
      const defCount = res.data.deficiencies.length;

      showToast(
        defCount > 0
          ? `Scrutiny Complete: ${defCount} deficiency clause(s) flagged. Moved to ${newStatus}.`
          : `Scrutiny Passed: Zero deficiencies. Moved to ${newStatus}.`
      );
      await loadData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      showToast(`Error running scrutiny: ${msg}`);
    } finally {
      setActionLoadingId(null);
    }
  };

  const openAdvanceDialog = (app: Application) => {
    setAdvancingApp(app);
    const validNext = NEXT_STATE_TRANSITIONS[app.status] || [];
    setSelectedNextStatus(validNext[0] || '');
    setAdvanceRemarks('');
  };

  const handleConfirmAdvance = async () => {
    if (!advancingApp || !selectedNextStatus) return;

    setActionLoadingId(advancingApp.id);
    try {
      await advanceApplication(advancingApp.id, selectedNextStatus as Status, advanceRemarks);
      showToast(`Successfully advanced ${advancingApp.id} to ${selectedNextStatus}`);
      setAdvancingApp(null);
      await loadData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      showToast(`State transition failed: ${msg}`);
    } finally {
      setActionLoadingId(null);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <DemoBanner show={isDemo} />

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white px-5 py-3 rounded-xl shadow-2xl border border-slate-700 text-xs font-medium flex items-center gap-2 animate-bounce">
          <CheckCircle className="w-4 h-4 text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
        <div>
          <div className="flex items-center gap-2 text-gov-blue-800">
            <ClipboardCheck className="w-5 h-5 text-amber-600" />
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
              Scrutiny Officer Queue
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-slate-600 mt-1">
            Automated compliance evaluation against AICTE Approval Process Handbook (APH 2024–25).
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
                <th className="px-4 py-3">Deficiencies</th>
                <th className="px-4 py-3 text-right">Workflow Actions</th>
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

                  return (
                    <tr key={app.id} className="hover:bg-slate-50/70 transition-colors">
                      {/* ID */}
                      <td className="px-4 py-3.5 font-mono font-bold text-gov-blue-900 whitespace-nowrap">
                        <Link
                          href={`/verify/${app.id}`}
                          className="hover:underline flex items-center gap-1"
                          title="Verify cryptographic hash chain"
                        >
                          <span>{app.id}</span>
                          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                        </Link>
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

                      {/* Deficiencies */}
                      <td className="px-4 py-3.5">
                        {app.deficiencies && app.deficiencies.length > 0 ? (
                          <span className="inline-flex items-center gap-1 font-semibold text-red-700 bg-red-50 border border-red-200 px-2 py-0.5 rounded text-[11px]">
                            <AlertTriangle className="w-3 h-3 text-red-500" />
                            {app.deficiencies.length} clause(s)
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded text-[11px]">
                            <CheckCircle className="w-3 h-3 text-emerald-500" />
                            Passed
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3.5 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-2">
                          {/* Run Scrutiny Button */}
                          <button
                            onClick={() => handleRunScrutiny(app)}
                            disabled={isActionBusy}
                            type="button"
                            className="px-2.5 py-1.5 rounded bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-semibold border border-indigo-200 text-[11px] transition-colors flex items-center gap-1 disabled:opacity-50"
                            title="Execute rules scrutiny engine"
                          >
                            <Sparkles className="w-3 h-3" />
                            <span>Run Scrutiny</span>
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
                Transition restricted strictly by AICTE approval state machine rules.
              </p>
            </div>

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
                  {(NEXT_STATE_TRANSITIONS[advancingApp.status] || []).map((target) => (
                    <option key={target} value={target}>
                      {target}
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-slate-500 mt-1">
                  Only states permitted by transition table are selectable.
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Officer Remarks / Executive Resolution
                </label>
                <textarea
                  rows={3}
                  placeholder="e.g. Scrutiny verified, scheduled for campus EVC visit."
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
