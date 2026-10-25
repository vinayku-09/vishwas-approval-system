'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Building2,
  PlusCircle,
  FileText,
  UploadCloud,
  X,
  ExternalLink,
  ChevronRight,
  ShieldCheck,
  Calendar,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';
import { Application, ApplicationType, Status } from '../../lib/types';
import { getApplications, createApplication } from '../../lib/api';
import { StatusBadge } from '../../components/StatusBadge';
import { SlaBadge } from '../../components/SlaBadge';
import { Timeline } from '../../components/Timeline';
import { DeficiencyList } from '../../components/DeficiencyList';
import { DemoBanner } from '../../components/DemoBanner';
import { formatDate } from '../../lib/utils';

export default function InstitutionPage() {
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDemo, setIsDemo] = useState(false);
  const [selectedApp, setSelectedApp] = useState<Application | null>(null);

  // New Application Dialog state
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState<{
    institutionName: string;
    type: ApplicationType;
    landAreaSqm: number;
    leaseEndDate: string;
    fireNocExpiry: string;
    leaseFileName: string;
    nocFileName: string;
  }>({
    institutionName: '',
    type: 'NEW',
    landAreaSqm: 7500,
    leaseEndDate: '2045-12-31',
    fireNocExpiry: '2028-06-30',
    leaseFileName: '',
    nocFileName: '',
  });

  const loadData = async () => {
    setLoading(true);
    const res = await getApplications();
    setApplications(res.data || []);
    setIsDemo(res.isDemo);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.institutionName.trim()) return;

    setSubmitting(true);
    try {
      const res = await createApplication({
        institutionName: formData.institutionName,
        type: formData.type,
        extracted: {
          landAreaSqm: Number(formData.landAreaSqm),
          leaseEndDate: formData.leaseEndDate,
          fireNocExpiry: formData.fireNocExpiry,
        },
      });

      setIsNewModalOpen(false);
      setFormData({
        institutionName: '',
        type: 'NEW',
        landAreaSqm: 7500,
        leaseEndDate: '2045-12-31',
        fireNocExpiry: '2028-06-30',
        leaseFileName: '',
        nocFileName: '',
      });
      await loadData();
      if (res.data) {
        setSelectedApp(res.data);
      }
    } catch (err) {
      console.error('Failed to create application:', err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <DemoBanner show={isDemo} />

      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
        <div>
          <div className="flex items-center gap-2 text-gov-blue-800">
            <Building2 className="w-5 h-5 text-gov-saffron" />
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
              Institution Portal
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-slate-600 mt-1">
            Manage your AICTE affiliation proposals, monitor live SLA deadlines, and review scrutiny reports.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={loadData}
            type="button"
            className="p-2.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600 transition-colors"
            title="Refresh list"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={() => setIsNewModalOpen(true)}
            type="button"
            className="px-4 py-2.5 rounded-lg bg-gov-blue-900 hover:bg-gov-blue-800 text-white font-semibold text-xs sm:text-sm flex items-center gap-2 shadow-sm transition-all"
          >
            <PlusCircle className="w-4 h-4 text-gov-saffron" />
            <span>New Application</span>
          </button>
        </div>
      </div>

      {/* Applications List */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50/50 flex items-center justify-between">
          <h2 className="font-bold text-sm text-slate-800">
            Affiliated Proposals ({applications.length})
          </h2>
          <span className="text-xs text-slate-500 font-mono">Academic Year 2024–25</span>
        </div>

        {loading ? (
          <div className="p-8 space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 bg-slate-100 rounded-lg animate-pulse" />
            ))}
          </div>
        ) : applications.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <FileText className="w-10 h-10 text-slate-300 mx-auto" />
            <p className="text-sm font-semibold text-slate-700">No applications found</p>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Get started by submitting your institution's affiliation or expansion proposal.
            </p>
            <button
              onClick={() => setIsNewModalOpen(true)}
              className="mt-2 px-4 py-2 bg-gov-blue-900 text-white text-xs font-semibold rounded-lg"
            >
              Submit First Application
            </button>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {applications.map((app) => (
              <div
                key={app.id}
                className="p-5 sm:p-6 hover:bg-slate-50/80 transition-colors flex flex-col md:flex-row md:items-center justify-between gap-4"
              >
                <div className="space-y-1.5 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-xs font-bold text-gov-blue-800 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                      {app.id}
                    </span>
                    <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                      {app.type.replace(/_/g, ' ')}
                    </span>
                    <StatusBadge status={app.status} size="sm" />
                  </div>
                  <h3 className="font-bold text-base text-slate-900">{app.institutionName}</h3>
                  <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500 pt-1">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5" />
                      Submitted: {formatDate(app.createdAt)}
                    </span>
                    {app.extracted?.landAreaSqm && (
                      <span>Land: {app.extracted.landAreaSqm.toLocaleString()} sq.m</span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-4 md:gap-6 justify-between md:justify-end">
                  <SlaBadge createdAt={app.createdAt} slaDueAt={app.slaDueAt} />
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setSelectedApp(app)}
                      type="button"
                      className="px-3.5 py-1.5 rounded-lg border border-slate-300 hover:border-gov-blue-800 hover:text-gov-blue-800 text-xs font-semibold transition-all flex items-center gap-1.5"
                    >
                      <span>View Drawer</span>
                      <ChevronRight className="w-4 h-4" />
                    </button>
                    <Link
                      href={`/verify/${app.id}`}
                      className="p-2 rounded-lg border border-slate-200 hover:bg-emerald-50 text-emerald-700 transition-colors"
                      title="Public Ledger Proof"
                    >
                      <ShieldCheck className="w-4 h-4" />
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* DETAIL DRAWER / MODAL */}
      {selectedApp && (
        <div className="fixed inset-0 z-50 overflow-hidden bg-slate-900/60 backdrop-blur-sm flex justify-end">
          <div className="w-full max-w-2xl bg-white h-full shadow-2xl flex flex-col overflow-y-auto">
            {/* Drawer Header */}
            <div className="p-6 bg-gov-blue-900 text-white border-b-4 border-gov-saffron flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-mono text-xs font-bold bg-white/20 px-2 py-0.5 rounded text-white">
                    {selectedApp.id}
                  </span>
                  <span className="text-xs uppercase text-blue-200">
                    {selectedApp.type.replace(/_/g, ' ')}
                  </span>
                </div>
                <h2 className="text-lg font-bold">{selectedApp.institutionName}</h2>
              </div>
              <button
                onClick={() => setSelectedApp(null)}
                className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Drawer Content */}
            <div className="p-6 space-y-6 flex-1">
              {/* Status and SLA summary */}
              <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-xl bg-slate-50 border border-slate-200">
                <div>
                  <span className="text-[11px] uppercase font-bold text-slate-500 block mb-1">
                    Current Status
                  </span>
                  <StatusBadge status={selectedApp.status} size="md" />
                </div>
                <div>
                  <span className="text-[11px] uppercase font-bold text-slate-500 block mb-1">
                    SLA Compliance
                  </span>
                  <SlaBadge createdAt={selectedApp.createdAt} slaDueAt={selectedApp.slaDueAt} />
                </div>
              </div>

              {/* Workflow Timeline */}
              <div className="space-y-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Approval Lifecycle Progression
                </h3>
                <div className="p-4 rounded-xl border border-slate-200 bg-white">
                  <Timeline currentStatus={selectedApp.status} />
                </div>
              </div>

              {/* Scrutiny Deficiencies */}
              <div className="space-y-2">
                <DeficiencyList deficiencies={selectedApp.deficiencies} />
              </div>

              {/* Extracted Land & NOC Metadata */}
              <div className="space-y-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Extracted Document Metrics
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="p-3 rounded-lg border border-slate-200 bg-slate-50/50">
                    <span className="text-[11px] text-slate-500 block">Land Area</span>
                    <span className="text-sm font-bold text-slate-800">
                      {selectedApp.extracted?.landAreaSqm
                        ? `${selectedApp.extracted.landAreaSqm.toLocaleString()} sq.m`
                        : 'Not extracted'}
                    </span>
                  </div>
                  <div className="p-3 rounded-lg border border-slate-200 bg-slate-50/50">
                    <span className="text-[11px] text-slate-500 block">Lease Deed Expiry</span>
                    <span className="text-sm font-bold text-slate-800 font-mono">
                      {selectedApp.extracted?.leaseEndDate || 'N/A'}
                    </span>
                  </div>
                  <div className="p-3 rounded-lg border border-slate-200 bg-slate-50/50">
                    <span className="text-[11px] text-slate-500 block">Fire NOC Expiry</span>
                    <span className="text-sm font-bold text-slate-800 font-mono">
                      {selectedApp.extracted?.fireNocExpiry || 'N/A'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Public Ledger Link */}
              <div className="p-4 rounded-xl bg-gov-blue-50 border border-blue-200 flex items-center justify-between">
                <div className="space-y-0.5">
                  <span className="text-xs font-bold text-gov-blue-900 flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-emerald-600" />
                    Cryptographic Audit Trail
                  </span>
                  <p className="text-[11px] text-slate-600">
                    View public SHA-256 blocks and real-time hash chain verification.
                  </p>
                </div>
                <Link
                  href={`/verify/${selectedApp.id}`}
                  className="px-3 py-1.5 bg-gov-blue-900 text-white text-xs font-semibold rounded-lg flex items-center gap-1 hover:bg-gov-blue-800"
                >
                  <span>Verify</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>

            {/* Drawer Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end">
              <button
                onClick={() => setSelectedApp(null)}
                className="px-4 py-2 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-semibold"
              >
                Close Drawer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* NEW APPLICATION MODAL */}
      {isNewModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full border border-slate-200 shadow-2xl overflow-hidden">
            <div className="p-6 bg-gov-blue-900 text-white border-b-4 border-gov-saffron flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold">New Institution Application</h2>
                <p className="text-xs text-blue-200 mt-0.5">
                  AICTE Approval Process Handbook (APH 2024–25)
                </p>
              </div>
              <button
                onClick={() => setIsNewModalOpen(false)}
                className="p-1 rounded-lg bg-white/10 hover:bg-white/20"
              >
                <X className="w-5 h-5 text-white" />
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Institution Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. National Institute of Applied Sciences"
                  value={formData.institutionName}
                  onChange={(e) =>
                    setFormData({ ...formData, institutionName: e.target.value })
                  }
                  className="w-full px-3.5 py-2 border border-slate-300 rounded-lg text-sm focus:border-gov-blue-800 focus:ring-1 focus:ring-gov-blue-800"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Application Type *
                </label>
                <select
                  value={formData.type}
                  onChange={(e) =>
                    setFormData({ ...formData, type: e.target.value as ApplicationType })
                  }
                  className="w-full px-3.5 py-2 border border-slate-300 rounded-lg text-sm bg-white"
                >
                  <option value="NEW">New Institution Approval</option>
                  <option value="EXTENSION_OF_APPROVAL">Extension of Approval (EoA)</option>
                  <option value="INTAKE_CHANGE">Intake Expansion / Course Addition</option>
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                    Land (sq.m)
                  </label>
                  <input
                    type="number"
                    value={formData.landAreaSqm}
                    onChange={(e) =>
                      setFormData({ ...formData, landAreaSqm: Number(e.target.value) })
                    }
                    className="w-full px-2.5 py-2 border border-slate-300 rounded-lg text-xs"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                    Lease Expiry
                  </label>
                  <input
                    type="date"
                    value={formData.leaseEndDate}
                    onChange={(e) =>
                      setFormData({ ...formData, leaseEndDate: e.target.value })
                    }
                    className="w-full px-2.5 py-2 border border-slate-300 rounded-lg text-xs"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                    Fire NOC Expiry
                  </label>
                  <input
                    type="date"
                    value={formData.fireNocExpiry}
                    onChange={(e) =>
                      setFormData({ ...formData, fireNocExpiry: e.target.value })
                    }
                    className="w-full px-2.5 py-2 border border-slate-300 rounded-lg text-xs"
                  />
                </div>
              </div>

              {/* Upload Stubs (UI Only for Hackathon Step) */}
              <div className="space-y-3 pt-2">
                <label className="block text-xs font-bold text-slate-700 uppercase">
                  Mandatory Affidavits & Deeds (PDF Upload Stubs)
                </label>

                {/* Lease deed upload */}
                <div className="border-2 border-dashed border-slate-200 rounded-xl p-3 text-center hover:bg-slate-50 transition-colors">
                  <UploadCloud className="w-5 h-5 text-slate-400 mx-auto mb-1" />
                  <p className="text-xs text-slate-700 font-medium">
                    {formData.leaseFileName || 'Registered Land Lease Deed / Khasra Document'}
                  </p>
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    // UI stub: Multimodal OCR will extract acreage & dates automatically
                  </p>
                  <input
                    type="file"
                    accept=".pdf"
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        leaseFileName: e.target.files?.[0]?.name || '',
                      })
                    }
                    className="mt-1 text-[11px] text-slate-500"
                  />
                </div>

                {/* Fire NOC upload */}
                <div className="border-2 border-dashed border-slate-200 rounded-xl p-3 text-center hover:bg-slate-50 transition-colors">
                  <UploadCloud className="w-5 h-5 text-slate-400 mx-auto mb-1" />
                  <p className="text-xs text-slate-700 font-medium">
                    {formData.nocFileName || 'Fire Safety Certificate / State NOC'}
                  </p>
                  <input
                    type="file"
                    accept=".pdf"
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        nocFileName: e.target.files?.[0]?.name || '',
                      })
                    }
                    className="mt-1 text-[11px] text-slate-500"
                  />
                </div>
              </div>

              <div className="pt-4 flex items-center justify-end gap-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsNewModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 text-xs font-bold text-white bg-gov-saffron hover:bg-orange-600 rounded-lg shadow-sm disabled:opacity-50 flex items-center gap-1.5"
                >
                  {submitting && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  <span>Submit Application</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
