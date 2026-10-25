'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Users,
  Calendar,
  MapPin,
  CheckCircle2,
  Clock,
  ShieldCheck,
  Building,
  FileText,
  AlertCircle,
  X,
  Send,
  UserCheck,
} from 'lucide-react';
import { Application, EvcReportFindings, InspectionAssignment } from '../../lib/types';
import { getApplications, getInspections, submitEvcReport } from '../../lib/api';
import { INITIAL_MOCK_INSPECTORS } from '../../lib/mock';
import { StatusBadge } from '../../components/StatusBadge';
import { DemoBanner } from '../../components/DemoBanner';
import { formatDate } from '../../lib/utils';

export default function CommitteePage() {
  const [applications, setApplications] = useState<Application[]>([]);
  const [inspections, setInspections] = useState<InspectionAssignment[]>([]);
  const [selectedInspectorId, setSelectedInspectorId] = useState<string>('ALL');
  const [loading, setLoading] = useState(true);
  const [isDemo, setIsDemo] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // EVC Report Filing Modal
  const [reportingApp, setReportingApp] = useState<Application | null>(null);
  const [reportingSubmitting, setReportingSubmitting] = useState(false);
  const [infrastructure, setInfrastructure] = useState(
    'Campus premises inspected. Academic area meets all regulatory requirements with adequate ventilation and fire egress.'
  );
  const [faculty, setFaculty] = useState(
    'Cadre ratio of 1:15 satisfied across departments with verified doctoral credentials and biometric records.'
  );
  const [labs, setLabs] = useState(
    'Specialized engineering laboratories and high-performance computing facilities fully operational with licensed tools.'
  );
  const [remarks, setRemarks] = useState(
    'The institution satisfies all AICTE statutory physical infrastructure and instructional norms without deficiency.'
  );
  const [recommendation, setRecommendation] = useState<'RECOMMENDED' | 'DEFICIENT'>('RECOMMENDED');

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 5000);
  };

  const loadData = async () => {
    setLoading(true);
    const appRes = await getApplications();
    setApplications(appRes.data || []);
    setIsDemo(appRes.isDemo);

    const inspRes = await getInspections(selectedInspectorId === 'ALL' ? undefined : selectedInspectorId);
    setInspections(inspRes.data || []);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, [selectedInspectorId]);

  const handleOpenReportModal = (app: Application) => {
    setReportingApp(app);
  };

  const handleSubmitReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reportingApp) return;

    setReportingSubmitting(true);
    try {
      const findings: EvcReportFindings = {
        infrastructure,
        faculty,
        labs,
        remarks,
      };

      const res = await submitEvcReport(reportingApp.id, {
        findings,
        recommendation,
        actorId: selectedInspectorId !== 'ALL' ? selectedInspectorId : 'INS-002',
      });

      if (res.error) {
        showToast(res.error, 'error');
      } else {
        showToast(
          `EVC Report submitted! Application ${reportingApp.id} moved to EVC_DONE. Report hash anchored in audit ledger.`,
          'success'
        );
        setReportingApp(null);
        await loadData();
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      showToast(`Submission failed: ${msg}`, 'error');
    } finally {
      setReportingSubmitting(false);
    }
  };

  // Applications in EVC scope
  const evcApplications = applications.filter((a) =>
    ['EVC_REQUIRED', 'EVC_DONE', 'DECISION', 'APPROVED'].includes(a.status)
  );

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <DemoBanner show={isDemo} />

      {/* Floating Toast Notification */}
      {toast && (
        <div
          className={`fixed bottom-6 right-6 z-50 px-5 py-3.5 rounded-xl shadow-2xl border text-xs font-semibold flex items-center gap-2.5 animate-bounce ${
            toast.type === 'error'
              ? 'bg-red-900 border-red-700 text-white'
              : 'bg-slate-900 border-slate-700 text-white'
          }`}
        >
          {toast.type === 'error' ? (
            <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
          ) : (
            <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
          )}
          <span>{toast.message}</span>
        </div>
      )}

      {/* Header bar */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-purple-700">
            <Users className="w-5 h-5 text-purple-700" />
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
              Expert Visit Committee (EVC) Inspections
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-slate-600 mt-1">
            Assigned physical campus reviews, peer evaluator inspections, and tamper-evident findings submission.
          </p>
        </div>

        {/* Inspector Role Switcher */}
        <div className="flex items-center gap-2">
          <label className="text-xs font-semibold text-slate-600">Simulate Inspector:</label>
          <select
            value={selectedInspectorId}
            onChange={(e) => setSelectedInspectorId(e.target.value)}
            className="px-3 py-1.5 rounded-lg border border-purple-200 bg-purple-50 text-purple-900 text-xs font-bold"
          >
            <option value="ALL">All Assigned Inspections</option>
            {INITIAL_MOCK_INSPECTORS.map((ins) => (
              <option key={ins.id} value={ins.id}>
                {ins.name} ({ins.domain} - {ins.homeCity})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Inspections Grid */}
      <div className="space-y-4">
        <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wider flex items-center justify-between">
          <span>Assigned EVC Inspections ({evcApplications.length})</span>
          <span className="text-xs text-slate-400 font-normal">Teams of 2 peer evaluators</span>
        </h2>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[1, 2].map((i) => (
              <div key={i} className="h-56 bg-slate-100 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : evcApplications.length === 0 ? (
          <div className="bg-white p-12 text-center rounded-xl border border-slate-200 text-slate-500">
            No campus inspections currently assigned in EVC queue.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {evcApplications.map((app) => {
              const inspection = inspections.find((i) => i.applicationId === app.id) || app.scheduledInspection;
              const isCompleted = app.status !== 'EVC_REQUIRED';
              const canReport = app.status === 'EVC_REQUIRED';

              return (
                <div
                  key={app.id}
                  className="bg-white rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-all p-6 flex flex-col justify-between space-y-4"
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs font-bold text-gov-blue-800 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                        {app.id}
                      </span>
                      <StatusBadge status={app.status} size="sm" />
                    </div>

                    <div>
                      <h3 className="font-bold text-base text-slate-900">{app.institutionName}</h3>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-indigo-50 text-indigo-800 border border-indigo-200">
                          {app.domain || 'CSE'}
                        </span>
                        <span className="text-xs text-slate-500 uppercase tracking-wide">
                          {app.type.replace(/_/g, ' ')}
                        </span>
                      </div>
                    </div>

                    {/* Inspection Details Strip */}
                    <div className="grid grid-cols-2 gap-2 text-xs text-slate-600 bg-slate-50 p-3 rounded-lg border border-slate-100">
                      <div className="flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-purple-600" />
                        <span>Date: {inspection?.scheduledDate || '2026-11-04'}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Building className="w-3.5 h-3.5 text-slate-400" />
                        <span>Land: {app.extracted?.landAreaSqm?.toLocaleString() || '10,000+'} sq.m</span>
                      </div>
                    </div>

                    {/* Assigned Team */}
                    {inspection && (
                      <div className="space-y-1 bg-purple-50/50 p-3 rounded-lg border border-purple-100 text-xs">
                        <span className="text-[10px] font-bold text-purple-900 uppercase tracking-wider block">
                          Assigned 2-Member Inspection Team:
                        </span>
                        <div className="space-y-1">
                          {inspection.inspectors.map((ins) => (
                            <div key={ins.id} className="flex items-center gap-1.5 text-purple-950 font-medium">
                              <UserCheck className="w-3.5 h-3.5 text-purple-700" />
                              <span>{ins.name}</span>
                              <span className="text-[10px] text-purple-600">({ins.homeCity})</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Report Status */}
                    {inspection?.report ? (
                      <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-xs space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-emerald-900 flex items-center gap-1">
                            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                            Report Filed: {inspection.report.recommendation}
                          </span>
                          <span className="text-[10px] text-emerald-700 font-mono">
                            {formatDate(inspection.report.submittedAt)}
                          </span>
                        </div>
                        <p className="text-[11px] text-emerald-800 italic">
                          "{inspection.report.findings.remarks}"
                        </p>
                        <div className="text-[10px] font-mono text-emerald-700 truncate pt-1">
                          Hash: {inspection.report.reportHash}
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between p-2.5 rounded bg-amber-50 text-amber-900 border border-amber-200 text-xs">
                        <span className="flex items-center gap-1.5 font-medium">
                          <Clock className="w-3.5 h-3.5 text-amber-600" />
                          Physical Inspection Pending Report
                        </span>
                        <span className="text-[10px] font-bold uppercase tracking-wider bg-amber-200/60 px-1.5 py-0.5 rounded">
                          EVC_REQUIRED
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Actions Bar */}
                  <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                    <Link
                      href={`/verify/${app.id}`}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-gov-blue-800 hover:text-gov-blue-900"
                    >
                      <span>Ledger Audit</span>
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                    </Link>

                    {canReport && (
                      <button
                        onClick={() => handleOpenReportModal(app)}
                        type="button"
                        className="px-3.5 py-1.5 rounded-lg bg-purple-700 hover:bg-purple-800 text-white font-semibold text-xs flex items-center gap-1.5 shadow-sm transition-colors"
                      >
                        <FileText className="w-3.5 h-3.5" />
                        <span>File EVC Report</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* EVC REPORT SUBMISSION MODAL */}
      {reportingApp && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full border border-slate-200 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-5 bg-purple-900 text-white border-b-4 border-gov-saffron flex items-center justify-between">
              <div>
                <span className="font-mono text-xs font-bold bg-white/20 px-2 py-0.5 rounded text-white">
                  {reportingApp.id}
                </span>
                <h2 className="text-base font-bold mt-1">
                  EVC Physical Campus Inspection Report
                </h2>
                <p className="text-xs text-purple-200">{reportingApp.institutionName}</p>
              </div>
              <button
                onClick={() => setReportingApp(null)}
                className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitReport} className="p-6 space-y-4 overflow-y-auto flex-1 text-xs">
              <div>
                <label className="font-bold text-slate-800 uppercase tracking-wider block mb-1">
                  1. Infrastructure & Land Norms Verification
                </label>
                <textarea
                  value={infrastructure}
                  onChange={(e) => setInfrastructure(e.target.value)}
                  rows={2}
                  required
                  className="w-full p-2.5 rounded-lg border border-slate-200 bg-slate-50 font-medium text-slate-900"
                />
              </div>

              <div>
                <label className="font-bold text-slate-800 uppercase tracking-wider block mb-1">
                  2. Faculty Cadre & Ratio Verification
                </label>
                <textarea
                  value={faculty}
                  onChange={(e) => setFaculty(e.target.value)}
                  rows={2}
                  required
                  className="w-full p-2.5 rounded-lg border border-slate-200 bg-slate-50 font-medium text-slate-900"
                />
              </div>

              <div>
                <label className="font-bold text-slate-800 uppercase tracking-wider block mb-1">
                  3. Laboratories, Computing & Equipment Verification
                </label>
                <textarea
                  value={labs}
                  onChange={(e) => setLabs(e.target.value)}
                  rows={2}
                  required
                  className="w-full p-2.5 rounded-lg border border-slate-200 bg-slate-50 font-medium text-slate-900"
                />
              </div>

              <div>
                <label className="font-bold text-slate-800 uppercase tracking-wider block mb-1">
                  4. General Remarks & Summary
                </label>
                <textarea
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  rows={2}
                  required
                  className="w-full p-2.5 rounded-lg border border-slate-200 bg-slate-50 font-medium text-slate-900"
                />
              </div>

              <div>
                <label className="font-bold text-slate-800 uppercase tracking-wider block mb-2">
                  5. Committee Recommendation
                </label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 cursor-pointer font-bold text-emerald-800">
                    <input
                      type="radio"
                      name="recommendation"
                      value="RECOMMENDED"
                      checked={recommendation === 'RECOMMENDED'}
                      onChange={() => setRecommendation('RECOMMENDED')}
                    />
                    <span>RECOMMENDED for Approval</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer font-bold text-red-800">
                    <input
                      type="radio"
                      name="recommendation"
                      value="DEFICIENT"
                      checked={recommendation === 'DEFICIENT'}
                      onChange={() => setRecommendation('DEFICIENT')}
                    />
                    <span>DEFICIENT (Norms Not Met)</span>
                  </label>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-200 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setReportingApp(null)}
                  className="px-4 py-2 rounded-lg border border-slate-200 text-slate-700 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={reportingSubmitting}
                  className="px-4 py-2 rounded-lg bg-purple-700 hover:bg-purple-800 text-white font-bold flex items-center gap-2 shadow disabled:opacity-50"
                >
                  <Send className={`w-3.5 h-3.5 ${reportingSubmitting ? 'animate-spin' : ''}`} />
                  <span>
                    {reportingSubmitting ? 'Submitting & Hashing...' : 'Submit Report (Advance to EVC_DONE)'}
                  </span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
