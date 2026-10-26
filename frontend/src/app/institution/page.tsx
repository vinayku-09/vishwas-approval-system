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
  Sparkles,
  FileCheck,
  AlertTriangle,
  Lock,
  Clock,
  CheckCircle2,
  HelpCircle,
  FileCode,
} from 'lucide-react';
import {
  Application,
  ApplicationType,
  ComplianceDocument,
  DocumentMetadata,
  DocumentType,
} from '../../lib/types';
import {
  getApplications,
  createApplication,
  uploadDocument,
  getDocuments,
  runExtract,
  getCompliance,
} from '../../lib/api';
import { StatusBadge } from '../../components/StatusBadge';
import { SlaBadge } from '../../components/SlaBadge';
import { Timeline } from '../../components/Timeline';
import { DeficiencyList } from '../../components/DeficiencyList';
import { formatDate, shortHash } from '../../lib/utils';

export default function InstitutionPage() {
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedApp, setSelectedApp] = useState<Application | null>(null);
  const [activeDrawerTab, setActiveDrawerTab] = useState<'overview' | 'documents' | 'compliance'>('overview');

  // Documents & Compliance state for selected app
  const [appDocuments, setAppDocuments] = useState<DocumentMetadata[]>([]);
  const [appCompliance, setAppCompliance] = useState<ComplianceDocument[]>([]);
  const [loadingDrawerData, setLoadingDrawerData] = useState(false);
  const [extracting, setExtracting] = useState(false);

  // Upload state
  const [uploadingDocType, setUploadingDocType] = useState<DocumentType | null>(null);
  const [uploadSuccessMsg, setUploadSuccessMsg] = useState<string | null>(null);

  // New Application Dialog state
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState<{
    institutionName: string;
    type: ApplicationType;
    landAreaSqm: number;
    leaseEndDate: string;
    fireNocExpiry: string;
  }>({
    institutionName: '',
    type: 'NEW',
    landAreaSqm: 7500,
    leaseEndDate: '2045-12-31',
    fireNocExpiry: '2028-06-30',
  });

  const loadData = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await getApplications();
      setApplications(res.data || []);
    } catch (err) {
      setApplications([]);
      setLoadError(
        err instanceof Error ? err.message : 'Unable to load your applications.'
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // When an app is selected in drawer, fetch its uploaded documents and compliance
  useEffect(() => {
    if (!selectedApp) return;

    const fetchDetails = async () => {
      setLoadingDrawerData(true);
      try {
        const [docsRes, compRes] = await Promise.all([
          getDocuments(selectedApp.id),
          getCompliance(selectedApp.id),
        ]);
        setAppDocuments(docsRes.data || []);
        setAppCompliance(compRes.data?.documents || []);
      } catch (err) {
        setAppDocuments([]);
        setAppCompliance([]);
        setLoadError(
          err instanceof Error
            ? err.message
            : 'Unable to load documents for this application.'
        );
      } finally {
        setLoadingDrawerData(false);
      }
    };

    fetchDetails();
  }, [selectedApp?.id]);

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.institutionName.trim()) return;

    setSubmitting(false);
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

  const handleFileUpload = async (docType: DocumentType, file: File) => {
    if (!selectedApp) return;
    setUploadingDocType(docType);
    setUploadSuccessMsg(null);

    try {
      const res = await uploadDocument(selectedApp.id, file, docType);
      if (res.data) {
        setAppDocuments((prev) => [...prev, res.data]);
        setUploadSuccessMsg(`Successfully uploaded ${file.name} (SHA-256: ${shortHash(res.data.sha256, 8)})`);
        setTimeout(() => setUploadSuccessMsg(null), 5000);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      alert(`Upload failed: ${msg}`);
    } finally {
      setUploadingDocType(null);
    }
  };

  const handleRequestScrutiny = async () => {
    if (!selectedApp) return;
    setExtracting(true);

    try {
      const res = await runExtract(selectedApp.id);
      if (res.data?.application) {
        setSelectedApp(res.data.application);
        // Refresh full applications list
        await loadData();
        // Refresh compliance
        const compRes = await getCompliance(selectedApp.id);
        setAppCompliance(compRes.data?.documents || []);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      alert(`Scrutiny request error: ${msg}`);
    } finally {
      setExtracting(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">

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
            Manage your AICTE affiliation proposals, upload verified statutory deeds, and review AI scrutiny extractions.
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

      {loadError && (
        <div className="p-4 rounded-xl border border-red-200 bg-red-50 text-red-800 text-xs">
          <strong>Could not load data:</strong> {loadError}
        </div>
      )}

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
                    {app.locked && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-red-700 bg-red-100 border border-red-300 px-2 py-0.5 rounded-full">
                        <Lock className="w-3 h-3 text-red-600" />
                        Locked (Expired Docs)
                      </span>
                    )}
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
                    {app.extractedDetails?.source && (
                      <span className="font-semibold text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded text-[10px] uppercase">
                        AI Extracted ({app.extractedDetails.source})
                      </span>
                    )}
                    {app.route && (
                      <span className="text-[11px] text-slate-400">
                        {app.route.name} · stage {app.route.currentStage}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-4 md:gap-6 justify-between md:justify-end">
                  <SlaBadge createdAt={app.createdAt} slaDueAt={app.slaDueAt} />
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        setSelectedApp(app);
                        setActiveDrawerTab('overview');
                      }}
                      type="button"
                      className="px-3.5 py-1.5 rounded-lg border border-slate-300 hover:border-gov-blue-800 hover:text-gov-blue-800 text-xs font-semibold transition-all flex items-center gap-1.5"
                    >
                      <span>Manage</span>
                      <ChevronRight className="w-4 h-4" />
                    </button>
                    <Link
                      href={`/case/${app.id}`}
                      className="p-2 rounded-lg border border-slate-200 hover:bg-blue-50 text-gov-blue-800 transition-colors"
                      title="Read-only electronic case summary"
                    >
                      <FileText className="w-4 h-4" />
                    </Link>
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
          <div className="w-full max-w-3xl bg-white h-full shadow-2xl flex flex-col overflow-y-auto">
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
                  {selectedApp.locked && (
                    <span className="bg-red-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                      <Lock className="w-3 h-3" /> Locked
                    </span>
                  )}
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

            {/* Lock Alert Banner if locked */}
            {selectedApp.locked && (
              <div className="bg-red-600 text-white px-6 py-2.5 text-xs font-semibold flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Lock className="w-4 h-4" />
                  <span>
                    <strong>Application Locked:</strong> One or more compliance documents have expired. Officer override required to advance workflow.
                  </span>
                </div>
              </div>
            )}

            {/* Tab Navigation */}
            <div className="flex border-b border-slate-200 bg-slate-50 px-6 pt-2">
              <button
                onClick={() => setActiveDrawerTab('overview')}
                className={`px-4 py-2.5 text-xs font-bold border-b-2 transition-all ${
                  activeDrawerTab === 'overview'
                    ? 'border-gov-blue-900 text-gov-blue-900'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                Overview & AI Scrutiny
              </button>
              <button
                onClick={() => setActiveDrawerTab('documents')}
                className={`px-4 py-2.5 text-xs font-bold border-b-2 transition-all flex items-center gap-1.5 ${
                  activeDrawerTab === 'documents'
                    ? 'border-gov-blue-900 text-gov-blue-900'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <span>Uploaded Documents</span>
                <span className="bg-slate-200 text-slate-700 px-1.5 py-0.2 rounded-full text-[10px]">
                  {appDocuments.length}
                </span>
              </button>
              <button
                onClick={() => setActiveDrawerTab('compliance')}
                className={`px-4 py-2.5 text-xs font-bold border-b-2 transition-all flex items-center gap-1.5 ${
                  activeDrawerTab === 'compliance'
                    ? 'border-gov-blue-900 text-gov-blue-900'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <span>Compliance & Expiry</span>
                {appCompliance.some((c) => c.state === 'OVERDUE') && (
                  <span className="w-2 h-2 rounded-full bg-red-600 animate-ping" />
                )}
              </button>
            </div>

            {/* Drawer Body */}
            <div className="p-6 space-y-6 flex-1">
              {/* TAB 1: OVERVIEW & AI SCRUTINY */}
              {activeDrawerTab === 'overview' && (
                <div className="space-y-6">
                  {/* Status & SLA Bar */}
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

                  {/* Lifecycle progression */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                        Approval Lifecycle Progression
                      </h3>
                      {['SUBMITTED', 'DEFICIENT'].includes(selectedApp.status) && (
                        <button
                          onClick={handleRequestScrutiny}
                          disabled={extracting}
                          type="button"
                          className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold shadow-sm transition-all flex items-center gap-1.5 disabled:opacity-50"
                        >
                          <Sparkles className="w-3.5 h-3.5" />
                          <span>{extracting ? 'Running Scrutiny...' : 'Request AI Scrutiny'}</span>
                        </button>
                      )}
                    </div>
                    <div className="p-4 rounded-xl border border-slate-200 bg-white">
                      <Timeline currentStatus={selectedApp.status} />
                    </div>
                  </div>

                  {/* AI EXTRACTION RESULTS TABLE */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                        AI Scrutiny & Extraction Details
                      </h3>
                      {selectedApp.extractedDetails && (
                        <span
                          className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded border ${
                            selectedApp.extractedDetails.source === 'real'
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                              : 'bg-amber-50 text-amber-800 border-amber-300'
                          }`}
                        >
                          Engine: {selectedApp.extractedDetails.source === 'real' ? 'Vision AI' : 'Deterministic Mock'}
                        </span>
                      )}
                    </div>

                    {selectedApp.extractedDetails?.fields ? (
                      <div className="border border-slate-200 rounded-xl overflow-hidden shadow-xs">
                        <table className="w-full text-left text-xs">
                          <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold">
                            <tr>
                              <th className="p-2.5">Regulatory Field</th>
                              <th className="p-2.5">Extracted Value</th>
                              <th className="p-2.5">Confidence</th>
                              <th className="p-2.5">Evidence Snippet</th>
                              <th className="p-2.5">Page</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {Object.entries(selectedApp.extractedDetails.fields).map(([fieldName, item]) => {
                              const isLowConfidence = item.confidence < 0.7;
                              return (
                                <tr key={fieldName} className="hover:bg-slate-50/50">
                                  <td className="p-2.5 font-semibold text-slate-800">
                                    {fieldName}
                                  </td>
                                  <td className="p-2.5 font-mono font-bold text-gov-blue-900">
                                    {item.value !== undefined ? String(item.value) : 'N/A'}
                                  </td>
                                  <td className="p-2.5">
                                    <div className="flex items-center gap-1.5">
                                      <span
                                        className={`font-mono font-bold ${
                                          isLowConfidence ? 'text-amber-700' : 'text-emerald-700'
                                        }`}
                                      >
                                        {Math.round(item.confidence * 100)}%
                                      </span>
                                      {isLowConfidence && (
                                        <span className="text-[9px] uppercase font-bold bg-amber-100 text-amber-800 px-1 rounded">
                                          Review
                                        </span>
                                      )}
                                    </div>
                                    <div className="w-16 bg-slate-100 h-1 rounded-full overflow-hidden mt-1">
                                      <div
                                        className={`h-full ${
                                          isLowConfidence ? 'bg-amber-500' : 'bg-emerald-500'
                                        }`}
                                        style={{ width: `${item.confidence * 100}%` }}
                                      />
                                    </div>
                                  </td>
                                  <td className="p-2.5 text-[11px] text-slate-600 max-w-xs italic line-clamp-2">
                                    "{item.evidenceText}"
                                  </td>
                                  <td className="p-2.5 font-mono text-slate-500">
                                    {item.sourcePage ? `p. ${item.sourcePage}` : 'N/A'}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-500 flex items-center justify-between">
                        <span>No extraction results found yet for this application.</span>
                        <button
                          onClick={handleRequestScrutiny}
                          disabled={extracting}
                          className="px-3 py-1 bg-indigo-600 text-white rounded text-xs font-semibold"
                        >
                          Run Scrutiny Now
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Scrutiny Deficiencies */}
                  <div className="space-y-2">
                    <DeficiencyList deficiencies={selectedApp.deficiencies} />
                  </div>
                </div>
              )}

              {/* TAB 2: UPLOADED DOCUMENTS */}
              {activeDrawerTab === 'documents' && (
                <div className="space-y-6">
                  {uploadSuccessMsg && (
                    <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-800 text-xs font-medium flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                      <span>{uploadSuccessMsg}</span>
                    </div>
                  )}

                  <div className="space-y-3">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                      Upload Statutory Compliance Files (Max 10 MB: PDF, PNG, JPG)
                    </h3>

                    {/* Upload zones per document type */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      {(['LEASE_DEED', 'FIRE_NOC', 'LAND_RECORD'] as DocumentType[]).map((docType) => {
                        const isUploading = uploadingDocType === docType;
                        return (
                          <div
                            key={docType}
                            className="border-2 border-dashed border-slate-200 hover:border-gov-blue-800 rounded-xl p-4 text-center transition-colors bg-slate-50/50 flex flex-col justify-between"
                          >
                            <div className="space-y-1">
                              <UploadCloud className="w-6 h-6 text-slate-400 mx-auto" />
                              <span className="text-xs font-bold text-slate-800 block">
                                {docType.replace(/_/g, ' ')}
                              </span>
                              <p className="text-[10px] text-slate-500">
                                Registered deed, certified NOC, or Khasra plan
                              </p>
                            </div>

                            <label className="mt-3 cursor-pointer inline-flex items-center justify-center px-3 py-1.5 rounded-lg bg-gov-blue-900 text-white text-xs font-semibold hover:bg-gov-blue-800">
                              {isUploading ? (
                                <span className="flex items-center gap-1">
                                  <RefreshCw className="w-3 h-3 animate-spin" /> Uploading...
                                </span>
                              ) : (
                                <span>Choose File</span>
                              )}
                              <input
                                type="file"
                                accept=".pdf,.png,.jpg,.jpeg"
                                disabled={isUploading}
                                className="hidden"
                                onChange={(e) => {
                                  const file = e.target.files?.[0];
                                  if (file) handleFileUpload(docType, file);
                                }}
                              />
                            </label>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* List of uploaded documents */}
                  <div className="space-y-3">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                      Archived Document Records ({appDocuments.length})
                    </h3>

                    {appDocuments.length === 0 ? (
                      <div className="p-6 text-center text-xs text-slate-400 bg-slate-50 rounded-xl border border-slate-200">
                        No documents uploaded for this application yet.
                      </div>
                    ) : (
                      <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden bg-white">
                        {appDocuments.map((doc) => (
                          <div key={doc.id} className="p-3.5 flex items-center justify-between text-xs hover:bg-slate-50">
                            <div className="flex items-center gap-3">
                              <FileCheck className="w-5 h-5 text-emerald-600 flex-shrink-0" />
                              <div>
                                <span className="font-bold text-slate-800 block">{doc.fileName}</span>
                                <div className="flex items-center gap-2 text-[11px] text-slate-500 mt-0.5">
                                  <span className="bg-slate-100 text-slate-700 px-1.5 py-0.2 rounded font-semibold uppercase">
                                    {doc.docType.replace(/_/g, ' ')}
                                  </span>
                                  <span>{(doc.sizeBytes / 1024).toFixed(0)} KB</span>
                                  <span>Uploaded {formatDate(doc.uploadedAt)}</span>
                                </div>
                              </div>
                            </div>
                            <div className="text-right">
                              <span className="text-[10px] uppercase font-bold text-slate-400 block">
                                SHA-256 Digest
                              </span>
                              <span className="font-mono text-xs font-semibold text-gov-blue-900 bg-blue-50 px-2 py-0.5 rounded border border-blue-200" title={doc.sha256}>
                                {shortHash(doc.sha256, 8)}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* TAB 3: COMPLIANCE & EXPIRY */}
              {activeDrawerTab === 'compliance' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                        Monitored Compliance Documents
                      </h3>
                      <p className="text-[11px] text-slate-500">
                        Continuous expiry evaluation monitored by the daily scheduler.
                      </p>
                    </div>
                  </div>

                  {appCompliance.length === 0 ? (
                    <div className="p-6 text-center text-xs text-slate-400 bg-slate-50 rounded-xl border border-slate-200">
                      No compliance tracked documents found. Run scrutiny or extract documents first.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {appCompliance.map((comp) => {
                        const isOverdue = comp.state === 'OVERDUE';
                        const isWarning = comp.state === 'WARNING';

                        return (
                          <div
                            key={comp.id}
                            className={`p-4 rounded-xl border flex flex-col justify-between space-y-3 ${
                              isOverdue
                                ? 'bg-red-50/70 border-red-300'
                                : isWarning
                                ? 'bg-amber-50/70 border-amber-300'
                                : 'bg-emerald-50/50 border-emerald-200'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-bold uppercase tracking-wide text-slate-800">
                                {comp.docType.replace(/_/g, ' ')}
                              </span>
                              <span
                                className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${
                                  isOverdue
                                    ? 'bg-red-600 text-white'
                                    : isWarning
                                    ? 'bg-amber-600 text-white'
                                    : 'bg-emerald-600 text-white'
                                }`}
                              >
                                {comp.state}
                              </span>
                            </div>

                            <div className="space-y-1">
                              <div className="flex items-center justify-between text-xs">
                                <span className="text-slate-600">Expiry Date:</span>
                                <span className="font-mono font-bold text-slate-900">{comp.expiryDate}</span>
                              </div>
                              <div className="flex items-center justify-between text-xs">
                                <span className="text-slate-600">Remaining Buffer:</span>
                                <span
                                  className={`font-bold ${
                                    isOverdue ? 'text-red-700' : isWarning ? 'text-amber-800' : 'text-emerald-700'
                                  }`}
                                >
                                  {comp.daysRemaining > 0
                                    ? `${comp.daysRemaining} days left`
                                    : `${Math.abs(comp.daysRemaining)} days overdue`}
                                </span>
                              </div>
                            </div>

                            <div className="pt-2 border-t border-slate-200/50 text-[10px] text-slate-400">
                              Checked: {formatDate(comp.lastCheckedAt)}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Drawer Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
              <Link
                href={`/verify/${selectedApp.id}`}
                className="text-xs font-bold text-gov-blue-900 hover:underline flex items-center gap-1"
              >
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <span>Verify SHA-256 Ledger</span>
              </Link>
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
