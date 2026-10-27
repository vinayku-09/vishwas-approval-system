'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Building2,
  User,
  Users,
  CreditCard,
  FileText,
  Landmark,
  ShieldCheck,
  UploadCloud,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Loader2,
  Save,
  Send,
  Plus,
  Trash2,
  ArrowLeft,
  Lock,
  FileCheck2,
} from 'lucide-react';
import {
  getInstitutionProfile,
  saveInstitutionProfile,
  submitInstitutionProfile,
  uploadProfilePdf,
  getStoredUser,
} from '../../../lib/api';
import { InstitutionProfile, ProfileMember, ProfileStatus } from '../../../lib/types';
import { INDIAN_STATES } from '../../../config/states';
import { getRequiredDocuments, getStateLandRecordName } from '../../../config/landDocuments';

export default function InstitutionProfilePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Profile Form State
  const [status, setStatus] = useState<ProfileStatus>('DRAFT');
  const [flaggedItems, setFlaggedItems] = useState<InstitutionProfile['flaggedItems']>([]);

  // 1. College Details
  const [collegeName, setCollegeName] = useState('');
  const [fullAddress, setFullAddress] = useState('');
  const [pin, setPin] = useState('');
  const [state, setState] = useState(INDIAN_STATES[0]);
  const [district, setDistrict] = useState('');

  // 2. Contact Person
  const [contactName, setContactName] = useState('');
  const [contactDesignation, setContactDesignation] = useState('');
  const [contactMobile, setContactMobile] = useState('');
  const [contactEmail, setContactEmail] = useState('');

  // 3. Trust Details & Members
  const [trustName, setTrustName] = useState('');
  const [trustRegNumber, setTrustRegNumber] = useState('');
  const [members, setMembers] = useState<ProfileMember[]>([
    { name: '', role: 'President / Chairman', idProofNumber: '' },
  ]);

  // 4. Bank Details
  const [accountHolder, setAccountHolder] = useState('');
  const [bankName, setBankName] = useState('');
  const [branch, setBranch] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [maskedAccountNumber, setMaskedAccountNumber] = useState('');
  const [ifsc, setIfsc] = useState('');

  // 5. FDR Details
  const [fdrNumber, setFdrNumber] = useState('');
  const [fdrBankName, setFdrBankName] = useState('');
  const [fdrAmount, setFdrAmount] = useState<number>(1500000);
  const [fdrIssueDate, setFdrIssueDate] = useState('2024-01-15');
  const [fdrMaturityDate, setFdrMaturityDate] = useState('2034-01-15');
  const [fdrDocId, setFdrDocId] = useState<string>('');

  // 6. Land Details
  const [landType, setLandType] = useState<'OWNED' | 'RENTED'>('OWNED');
  const [totalAreaSqm, setTotalAreaSqm] = useState<number>(8500);
  const [khasraNumber, setKhasraNumber] = useState('');
  const [leaseStartDate, setLeaseStartDate] = useState('');
  const [leaseEndDate, setLeaseEndDate] = useState('');
  const [lessorName, setLessorName] = useState('');
  const [uploadedDocs, setUploadedDocs] = useState<Record<string, { id: string; sha256?: string; fileName?: string }>>({});

  // Uploading state tracking
  const [uploadingDocKey, setUploadingDocKey] = useState<string | null>(null);

  // Load existing profile on mount
  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    setLoading(true);
    setError(null);
    const res = await getInstitutionProfile();
    setLoading(false);

    if (res.data) {
      const p = res.data;
      setStatus(p.status || 'DRAFT');
      setFlaggedItems(p.flaggedItems || []);

      if (p.college) {
        setCollegeName(p.college.name || '');
        setFullAddress(p.college.fullAddress || '');
        setPin(p.college.pin || '');
        setState(p.college.state || INDIAN_STATES[0]);
        setDistrict(p.college.district || '');
      } else if (p.institutionName) {
        setCollegeName(p.institutionName);
      }

      if (p.contactPerson) {
        setContactName(p.contactPerson.name || '');
        setContactDesignation(p.contactPerson.designation || '');
        setContactMobile(p.contactPerson.mobile || '');
        setContactEmail(p.contactPerson.email || '');
      }

      if (p.trust) {
        setTrustName(p.trust.name || '');
        setTrustRegNumber(p.trust.registrationNumber || '');
        if (p.trust.members && p.trust.members.length > 0) {
          setMembers(p.trust.members);
        }
      }

      if (p.bank) {
        setAccountHolder(p.bank.accountHolder || '');
        setBankName(p.bank.bankName || '');
        setBranch(p.bank.branch || '');
        setMaskedAccountNumber(p.bank.maskedAccountNumber || '');
        setIfsc(p.bank.ifsc || '');
      }

      if (p.fdr) {
        setFdrNumber(p.fdr.fdrNumber || '');
        setFdrBankName(p.fdr.bankName || '');
        setFdrAmount(p.fdr.amount || 1500000);
        setFdrIssueDate(p.fdr.issueDate || '2024-01-15');
        setFdrMaturityDate(p.fdr.maturityDate || '2034-01-15');
        setFdrDocId(p.fdr.documentId || '');
        if (p.fdr.documentId) {
          setUploadedDocs((prev) => ({
            ...prev,
            fdrCertificate: { id: p.fdr.documentId!, sha256: p.fdr.documentSha256 },
          }));
        }
      }

      if (p.land) {
        setLandType(p.land.landType || 'OWNED');
        setTotalAreaSqm(p.land.totalAreaSqm || 8500);
        setKhasraNumber(p.land.khasraOrSurveyNumber || '');
        setLeaseStartDate(p.land.leaseStartDate || '');
        setLeaseEndDate(p.land.leaseEndDate || '');
        setLessorName(p.land.lessorName || '');
        if (p.land.documents) {
          p.land.documents.forEach((d) => {
            setUploadedDocs((prev) => ({
              ...prev,
              [d.docType]: { id: d.documentId, sha256: d.sha256, fileName: d.fileName },
            }));
          });
        }
      }

      if (p.statutoryPdfs) {
        p.statutoryPdfs.forEach((d) => {
          setUploadedDocs((prev) => ({
            ...prev,
            [d.docType]: { id: d.documentId, sha256: d.sha256, fileName: d.fileName },
          }));
        });
      }
    } else {
      // Pre-fill user college name if available
      const user = getStoredUser();
      if (user?.institutionName) {
        setCollegeName(user.institutionName);
      }
    }
  };

  const handleAddMember = () => {
    setMembers((prev) => [...prev, { name: '', role: 'Member', idProofNumber: '' }]);
  };

  const handleRemoveMember = (idx: number) => {
    setMembers((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleUpdateMember = (idx: number, field: keyof ProfileMember, val: string) => {
    setMembers((prev) =>
      prev.map((m, i) => (i === idx ? { ...m, [field]: val } : m))
    );
  };

  // PDF Upload Handler with Magic Bytes check & 10MB limit
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, docKey: string) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);
    setSuccessMsg(null);

    // 10MB limit check
    if (file.size > 10 * 1024 * 1024) {
      setError(`File "${file.name}" exceeds the maximum allowed size of 10 MB.`);
      return;
    }

    // Magic bytes check (%PDF-)
    const buffer = await file.slice(0, 5).arrayBuffer();
    const bytes = new Uint8Array(buffer);
    const magicString = Array.from(bytes)
      .map((b) => String.fromCharCode(b))
      .join('');
    if (!magicString.startsWith('%PDF-')) {
      setError(`Invalid file format for "${file.name}". Only genuine PDF files (%PDF-) are accepted.`);
      return;
    }

    setUploadingDocKey(docKey);
    const res = await uploadProfilePdf(file, docKey);
    setUploadingDocKey(null);

    if (res.error || !res.document) {
      setError(res.error || 'Failed to upload document');
      return;
    }

    setUploadedDocs((prev) => ({
      ...prev,
      [docKey]: {
        id: res.document.id,
        sha256: res.document.sha256,
        fileName: file.name,
      },
    }));

    if (docKey === 'fdrCertificate') {
      setFdrDocId(res.document.id);
    }

    setSuccessMsg(`Document "${file.name}" successfully uploaded and verified.`);
  };

  const buildProfilePayload = (): Partial<InstitutionProfile> => {
    const landDocs = Object.entries(uploadedDocs)
      .filter(([key]) => ['landRecord', 'titleDeed', 'mutationEntry', 'conversionOrder', 'leaseDeed', 'ownerNoc'].includes(key))
      .map(([docType, val]) => ({
        docType,
        documentId: val.id,
        sha256: val.sha256,
        fileName: val.fileName,
      }));

    const statutoryDocs = Object.entries(uploadedDocs)
      .filter(([key]) => ['trustRegistration', 'buildingPlan', 'fireNoc'].includes(key))
      .map(([docType, val]) => ({
        docType,
        documentId: val.id,
        sha256: val.sha256,
        fileName: val.fileName,
      }));

    return {
      college: {
        name: collegeName.trim(),
        fullAddress: fullAddress.trim(),
        pin: pin.trim(),
        state,
        district: district.trim(),
      },
      contactPerson: {
        name: contactName.trim(),
        designation: contactDesignation.trim(),
        mobile: contactMobile.trim(),
        email: contactEmail.trim(),
      },
      trust: {
        name: trustName.trim(),
        registrationNumber: trustRegNumber.trim(),
        members: members.filter((m) => m.name.trim() !== ''),
      },
      bank: {
        accountHolder: accountHolder.trim(),
        bankName: bankName.trim(),
        branch: branch.trim(),
        accountNumber: accountNumber.trim() || undefined,
        ifsc: ifsc.trim().toUpperCase(),
      },
      fdr: {
        fdrNumber: fdrNumber.trim(),
        bankName: fdrBankName.trim(),
        amount: Number(fdrAmount) || 0,
        issueDate: fdrIssueDate,
        maturityDate: fdrMaturityDate,
        documentId: fdrDocId || uploadedDocs['fdrCertificate']?.id,
        documentSha256: uploadedDocs['fdrCertificate']?.sha256,
      },
      land: {
        landType,
        totalAreaSqm: Number(totalAreaSqm) || 0,
        khasraOrSurveyNumber: khasraNumber.trim(),
        leaseStartDate: landType === 'RENTED' ? leaseStartDate : undefined,
        leaseEndDate: landType === 'RENTED' ? leaseEndDate : undefined,
        lessorName: landType === 'RENTED' ? lessorName.trim() : undefined,
        documents: landDocs,
      },
      statutoryPdfs: statutoryDocs,
    };
  };

  const handleSaveDraft = async () => {
    setSaving(true);
    setError(null);
    setSuccessMsg(null);

    const payload = buildProfilePayload();
    const res = await saveInstitutionProfile(payload);
    setSaving(false);

    if (res.error) {
      setError(res.error);
      return;
    }

    if (res.data) {
      setStatus(res.data.status);
      if (res.data.bank?.maskedAccountNumber) {
        setMaskedAccountNumber(res.data.bank.maskedAccountNumber);
        setAccountNumber('');
      }
    }
    setSuccessMsg('Profile draft successfully saved.');
  };

  const handleSubmitProfile = async () => {
    setError(null);
    setSuccessMsg(null);

    // Form completeness validation
    if (!collegeName.trim() || !fullAddress.trim() || !pin.trim() || !district.trim()) {
      setError('Please complete all College Details before submitting.');
      return;
    }
    if (!contactName.trim() || !contactMobile.trim() || !contactEmail.trim()) {
      setError('Please complete Contact Person details before submitting.');
      return;
    }
    if (!trustName.trim() || !trustRegNumber.trim()) {
      setError('Please provide Trust / Society registration details.');
      return;
    }
    if (!accountHolder.trim() || !bankName.trim() || !ifsc.trim()) {
      setError('Please complete Bank Details.');
      return;
    }
    if (!fdrNumber.trim() || !fdrBankName.trim()) {
      setError('Please complete FDR details.');
      return;
    }

    setSubmitting(true);
    // First save latest draft
    const saveRes = await saveInstitutionProfile(buildProfilePayload());
    if (saveRes.error) {
      setSubmitting(false);
      setError(saveRes.error);
      return;
    }

    // Now submit
    const res = await submitInstitutionProfile();
    setSubmitting(false);

    if (res.error) {
      setError(res.error);
      return;
    }

    if (res.profile) {
      setStatus(res.profile.status);
      setFlaggedItems(res.profile.flaggedItems || []);
      if (res.profile.bank?.maskedAccountNumber) {
        setMaskedAccountNumber(res.profile.bank.maskedAccountNumber);
      }
    }
    setSuccessMsg(
      'Profile submitted successfully! AI extraction has executed and a review task was dispatched to your Regional Officer.'
    );
  };

  const isLocked = status === 'SUBMITTED' || status === 'UNDER_REVIEW' || status === 'VERIFIED';
  const requiredDocs = getRequiredDocuments(landType, state);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="flex items-center gap-3 text-gov-blue-900 font-bold">
          <Loader2 className="w-6 h-6 animate-spin text-gov-saffron" />
          <span>Loading Institution Profile...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 pb-16">
      {/* Top Header */}
      <div className="bg-gov-blue-900 text-white border-b-4 border-gov-saffron py-6 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Link
                href="/institution"
                className="inline-flex items-center gap-1 text-xs text-blue-200 hover:text-white"
              >
                <ArrowLeft className="w-3.5 h-3.5" /> Back to Dashboard
              </Link>
            </div>
            <h1 className="text-2xl font-bold flex items-center gap-2.5">
              <Building2 className="w-6 h-6 text-gov-gold" />
              Institution Statutory Profile
            </h1>
            <p className="text-xs text-blue-100">
              Mandatory prerequisite profile for AICTE approvals, land verification, bank encryption, and FDR validation.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <span
              className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                status === 'VERIFIED'
                  ? 'bg-emerald-500 text-white'
                  : status === 'SUBMITTED' || status === 'UNDER_REVIEW'
                  ? 'bg-blue-500 text-white'
                  : status === 'DEFICIENT'
                  ? 'bg-red-500 text-white'
                  : 'bg-amber-400 text-slate-900'
              }`}
            >
              Status: {status}
            </span>

            {!isLocked && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={saving || submitting}
                  onClick={handleSaveDraft}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-semibold text-white border border-white/20 transition-all disabled:opacity-50"
                >
                  {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                  Save Draft
                </button>
                <button
                  type="button"
                  disabled={saving || submitting}
                  onClick={handleSubmitProfile}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-gov-saffron hover:bg-orange-600 text-xs font-bold text-white transition-all shadow-md disabled:opacity-50"
                >
                  {submitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                  Submit Profile
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 mt-6 space-y-6">
        {/* Alerts */}
        {error && (
          <div className="rounded-xl border border-red-300 bg-red-50 p-4 text-xs sm:text-sm text-red-900 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold">Error:</span> {error}
            </div>
          </div>
        )}

        {successMsg && (
          <div className="rounded-xl border border-emerald-300 bg-emerald-50 p-4 text-xs sm:text-sm text-emerald-900 flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
            <div>{successMsg}</div>
          </div>
        )}

        {/* Flagged Items Alert if any */}
        {flaggedItems && flaggedItems.length > 0 && (
          <div className="rounded-xl border border-amber-300 bg-amber-50 p-5 space-y-2">
            <div className="flex items-center gap-2 text-amber-900 font-bold text-sm">
              <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
              Scrutiny Flags Identified by Automated Verification
            </div>
            <p className="text-xs text-amber-800">
              The automated extraction engine detected items requiring clarification or scrutiny officer review:
            </p>
            <div className="space-y-1.5 pt-1">
              {flaggedItems.map((flag, idx) => (
                <div
                  key={idx}
                  className="bg-white/80 p-2.5 rounded-lg border border-amber-200 text-xs flex items-start justify-between gap-2"
                >
                  <div>
                    <span className="font-bold text-slate-800">{flag.item}:</span>{' '}
                    <span className="text-slate-600">{flag.reason}</span>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      flag.severity === 'CRITICAL' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-800'
                    }`}
                  >
                    {flag.severity}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {isLocked && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-xs text-blue-900 flex items-center gap-3">
            <Lock className="w-4 h-4 text-gov-blue-800 shrink-0" />
            <span>
              This profile is currently <strong>{status}</strong> and locked for regional scrutiny. If corrections are required, your regional officer will open clarification mode.
            </span>
          </div>
        )}

        {/* Form Sections */}
        <div className="grid grid-cols-1 gap-6">
          {/* Section 1: College Details */}
          <section className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-slate-100 text-gov-blue-900 font-bold text-base">
              <Building2 className="w-5 h-5 text-gov-saffron" />
              1. Technical College Information
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-xs font-semibold text-slate-700">College / Institute Name *</label>
                <input
                  type="text"
                  disabled={isLocked}
                  value={collegeName}
                  onChange={(e) => setCollegeName(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs focus:ring-2 focus:ring-gov-blue-700/30 disabled:bg-slate-50"
                  placeholder="e.g. Government Engineering College"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs font-semibold text-slate-700">Full Campus Address *</label>
                <textarea
                  rows={2}
                  disabled={isLocked}
                  value={fullAddress}
                  onChange={(e) => setFullAddress(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs focus:ring-2 focus:ring-gov-blue-700/30 disabled:bg-slate-50"
                  placeholder="Campus Survey No, Main Road, City / Taluka"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700">State *</label>
                <select
                  disabled={isLocked}
                  value={state}
                  onChange={(e) => setState(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs focus:ring-2 focus:ring-gov-blue-700/30 bg-white disabled:bg-slate-50"
                >
                  {INDIAN_STATES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700">District *</label>
                <input
                  type="text"
                  disabled={isLocked}
                  value={district}
                  onChange={(e) => setDistrict(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs focus:ring-2 focus:ring-gov-blue-700/30 disabled:bg-slate-50"
                  placeholder="District"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700">PIN Code *</label>
                <input
                  type="text"
                  maxLength={6}
                  disabled={isLocked}
                  value={pin}
                  onChange={(e) => setPin(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs focus:ring-2 focus:ring-gov-blue-700/30 disabled:bg-slate-50"
                  placeholder="e.g. 400001"
                />
              </div>
            </div>
          </section>

          {/* Section 2: Contact Person */}
          <section className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-slate-100 text-gov-blue-900 font-bold text-base">
              <User className="w-5 h-5 text-gov-saffron" />
              2. Authorized Contact Person
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700">Full Name *</label>
                <input
                  type="text"
                  disabled={isLocked}
                  value={contactName}
                  onChange={(e) => setContactName(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs focus:ring-2 focus:ring-gov-blue-700/30 disabled:bg-slate-50"
                  placeholder="Dr. / Prof. / Shri"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700">Designation *</label>
                <input
                  type="text"
                  disabled={isLocked}
                  value={contactDesignation}
                  onChange={(e) => setContactDesignation(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs focus:ring-2 focus:ring-gov-blue-700/30 disabled:bg-slate-50"
                  placeholder="Principal / Registrar"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700">Official Mobile *</label>
                <input
                  type="tel"
                  disabled={isLocked}
                  value={contactMobile}
                  onChange={(e) => setContactMobile(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs focus:ring-2 focus:ring-gov-blue-700/30 disabled:bg-slate-50"
                  placeholder="10-digit mobile"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700">Official Email *</label>
                <input
                  type="email"
                  disabled={isLocked}
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs focus:ring-2 focus:ring-gov-blue-700/30 disabled:bg-slate-50"
                  placeholder="principal@college.edu.in"
                />
              </div>
            </div>
          </section>

          {/* Section 3: Trust & Society Details */}
          <section className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2 text-gov-blue-900 font-bold text-base">
                <Users className="w-5 h-5 text-gov-saffron" />
                3. Sponsoring Trust / Society / Management Committee
              </div>
              {!isLocked && (
                <button
                  type="button"
                  onClick={handleAddMember}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-gov-blue-900 hover:text-gov-blue-800 bg-blue-50 px-2.5 py-1 rounded-md"
                >
                  <Plus className="w-3.5 h-3.5" /> Add Member
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700">Trust / Society Name *</label>
                <input
                  type="text"
                  disabled={isLocked}
                  value={trustName}
                  onChange={(e) => setTrustName(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs focus:ring-2 focus:ring-gov-blue-700/30 disabled:bg-slate-50"
                  placeholder="e.g. Vidya Vikas Educational Trust"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700">Registration Number *</label>
                <input
                  type="text"
                  disabled={isLocked}
                  value={trustRegNumber}
                  onChange={(e) => setTrustRegNumber(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs focus:ring-2 focus:ring-gov-blue-700/30 disabled:bg-slate-50"
                  placeholder="Reg. No. / Bombay Public Trust Act No."
                />
              </div>
            </div>

            {/* Members Repeater */}
            <div className="space-y-3 pt-2">
              <label className="block text-xs font-bold text-slate-700">Trustees / Committee Members</label>
              {members.map((member, idx) => (
                <div
                  key={idx}
                  className="grid grid-cols-1 sm:grid-cols-[1.2fr_1fr_1.2fr_auto] gap-2 p-3 rounded-lg bg-slate-50 border border-slate-200 items-center"
                >
                  <input
                    type="text"
                    disabled={isLocked}
                    value={member.name}
                    onChange={(e) => handleUpdateMember(idx, 'name', e.target.value)}
                    placeholder="Member Full Name"
                    className="rounded border border-slate-300 px-2.5 py-1.5 text-xs bg-white disabled:bg-slate-100"
                  />
                  <input
                    type="text"
                    disabled={isLocked}
                    value={member.role}
                    onChange={(e) => handleUpdateMember(idx, 'role', e.target.value)}
                    placeholder="Role (e.g. Trustee, Secretary)"
                    className="rounded border border-slate-300 px-2.5 py-1.5 text-xs bg-white disabled:bg-slate-100"
                  />
                  <input
                    type="text"
                    disabled={isLocked}
                    value={member.idProofNumber}
                    onChange={(e) => handleUpdateMember(idx, 'idProofNumber', e.target.value)}
                    placeholder="PAN / Aadhaar / Voter ID"
                    className="rounded border border-slate-300 px-2.5 py-1.5 text-xs bg-white disabled:bg-slate-100"
                  />
                  {!isLocked && members.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveMember(idx)}
                      className="p-1.5 text-red-600 hover:text-red-800 hover:bg-red-50 rounded"
                      title="Remove member"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </section>

          {/* Section 4: Bank Details with AES-256 Encryption */}
          <section className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2 text-gov-blue-900 font-bold text-base">
                <CreditCard className="w-5 h-5 text-gov-saffron" />
                4. Bank Account Details (AES-256-GCM Encrypted)
              </div>
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                <ShieldCheck className="w-3.5 h-3.5" /> Zero Knowledge Storage
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700">Account Holder Name *</label>
                <input
                  type="text"
                  disabled={isLocked}
                  value={accountHolder}
                  onChange={(e) => setAccountHolder(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs focus:ring-2 focus:ring-gov-blue-700/30 disabled:bg-slate-50"
                  placeholder="Account Holder"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700">Bank Name *</label>
                <input
                  type="text"
                  disabled={isLocked}
                  value={bankName}
                  onChange={(e) => setBankName(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs focus:ring-2 focus:ring-gov-blue-700/30 disabled:bg-slate-50"
                  placeholder="e.g. State Bank of India"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700">Branch Name *</label>
                <input
                  type="text"
                  disabled={isLocked}
                  value={branch}
                  onChange={(e) => setBranch(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs focus:ring-2 focus:ring-gov-blue-700/30 disabled:bg-slate-50"
                  placeholder="Branch location"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700">
                  Account Number * {maskedAccountNumber && <span className="text-slate-400 font-mono">({maskedAccountNumber})</span>}
                </label>
                <input
                  type="text"
                  disabled={isLocked}
                  value={accountNumber}
                  onChange={(e) => setAccountNumber(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-mono focus:ring-2 focus:ring-gov-blue-700/30 disabled:bg-slate-50"
                  placeholder={maskedAccountNumber ? 'Leave blank to retain current encrypted account' : 'Enter account number'}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700">IFSC Code *</label>
                <input
                  type="text"
                  maxLength={11}
                  disabled={isLocked}
                  value={ifsc}
                  onChange={(e) => setIfsc(e.target.value.toUpperCase())}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-mono uppercase focus:ring-2 focus:ring-gov-blue-700/30 disabled:bg-slate-50"
                  placeholder="SBIN0001234"
                />
              </div>
            </div>

            <p className="text-[11px] text-slate-500 bg-slate-50 p-2.5 rounded border border-slate-200">
              <strong>Cryptographic Privacy Guarantee:</strong> Bank account numbers are strictly encrypted with AES-256-GCM using isolated vault keys. Account numbers are masked (••••••••{maskedAccountNumber ? maskedAccountNumber.slice(-4) : '1234'}) in API responses and never logged or included in ledger proofs.
            </p>
          </section>

          {/* Section 5: FDR for AICTE */}
          <section className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-slate-100 text-gov-blue-900 font-bold text-base">
              <Landmark className="w-5 h-5 text-gov-saffron" />
              5. AICTE Security Deposit Fixed Deposit Receipt (FDR)
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700">FDR Number *</label>
                <input
                  type="text"
                  disabled={isLocked}
                  value={fdrNumber}
                  onChange={(e) => setFdrNumber(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs focus:ring-2 focus:ring-gov-blue-700/30 disabled:bg-slate-50"
                  placeholder="FDR-123456"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700">Issuing Bank *</label>
                <input
                  type="text"
                  disabled={isLocked}
                  value={fdrBankName}
                  onChange={(e) => setFdrBankName(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs focus:ring-2 focus:ring-gov-blue-700/30 disabled:bg-slate-50"
                  placeholder="Nationalized / Scheduled Bank"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700">Amount (INR) *</label>
                <input
                  type="number"
                  disabled={isLocked}
                  value={fdrAmount}
                  onChange={(e) => setFdrAmount(Number(e.target.value))}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs focus:ring-2 focus:ring-gov-blue-700/30 disabled:bg-slate-50"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700">Issue Date *</label>
                <input
                  type="date"
                  disabled={isLocked}
                  value={fdrIssueDate}
                  onChange={(e) => setFdrIssueDate(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs focus:ring-2 focus:ring-gov-blue-700/30 disabled:bg-slate-50"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700">Maturity Date *</label>
                <input
                  type="date"
                  disabled={isLocked}
                  value={fdrMaturityDate}
                  onChange={(e) => setFdrMaturityDate(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs focus:ring-2 focus:ring-gov-blue-700/30 disabled:bg-slate-50"
                />
              </div>
            </div>
          </section>

          {/* Section 6: Land Details & Document Checklist */}
          <section className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2 text-gov-blue-900 font-bold text-base">
                <FileText className="w-5 h-5 text-gov-saffron" />
                6. Land Details & State Document Verification
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={isLocked}
                  onClick={() => setLandType('OWNED')}
                  className={`px-3 py-1 rounded text-xs font-bold transition-all ${
                    landType === 'OWNED'
                      ? 'bg-gov-blue-900 text-white shadow'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  OWNED LAND
                </button>
                <button
                  type="button"
                  disabled={isLocked}
                  onClick={() => setLandType('RENTED')}
                  className={`px-3 py-1 rounded text-xs font-bold transition-all ${
                    landType === 'RENTED'
                      ? 'bg-gov-blue-900 text-white shadow'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  RENTED / LEASED LAND
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700">Total Land Area (sqm) *</label>
                <input
                  type="number"
                  disabled={isLocked}
                  value={totalAreaSqm}
                  onChange={(e) => setTotalAreaSqm(Number(e.target.value))}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs focus:ring-2 focus:ring-gov-blue-700/30 disabled:bg-slate-50"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700">Survey / Khasra Number *</label>
                <input
                  type="text"
                  disabled={isLocked}
                  value={khasraNumber}
                  onChange={(e) => setKhasraNumber(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs focus:ring-2 focus:ring-gov-blue-700/30 disabled:bg-slate-50"
                  placeholder="e.g. Survey No. 45/2A"
                />
              </div>

              {landType === 'RENTED' && (
                <>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700">Lessor / Land Owner Name *</label>
                    <input
                      type="text"
                      disabled={isLocked}
                      value={lessorName}
                      onChange={(e) => setLessorName(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs focus:ring-2 focus:ring-gov-blue-700/30 disabled:bg-slate-50"
                      placeholder="Lessor Name"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700">Lease Start Date *</label>
                    <input
                      type="date"
                      disabled={isLocked}
                      value={leaseStartDate}
                      onChange={(e) => setLeaseStartDate(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs focus:ring-2 focus:ring-gov-blue-700/30 disabled:bg-slate-50"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700">Lease End Date *</label>
                    <input
                      type="date"
                      disabled={isLocked}
                      value={leaseEndDate}
                      onChange={(e) => setLeaseEndDate(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs focus:ring-2 focus:ring-gov-blue-700/30 disabled:bg-slate-50"
                    />
                  </div>
                </>
              )}
            </div>

            {/* State land record name hint */}
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs text-slate-700">
              <span className="font-bold">State Document Mapping ({state}):</span> The state-equivalent statutory land title document required for <strong>{state}</strong> is{' '}
              <span className="font-semibold text-gov-blue-900">{getStateLandRecordName(state)}</span>.
            </div>

            {/* Document Uploads Checklist */}
            <div className="space-y-3 pt-3">
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                Required Statutory PDFs (Magic Bytes: %PDF-, Max 10MB)
              </h3>

              <div className="grid grid-cols-1 gap-3">
                {requiredDocs.map((docSpec) => {
                  const uploaded = uploadedDocs[docSpec.docKey];
                  const isUploading = uploadingDocKey === docSpec.docKey;

                  return (
                    <div
                      key={docSpec.docKey}
                      className="p-4 rounded-xl border border-slate-200 bg-white hover:border-slate-300 transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <FileCheck2 className="w-4 h-4 text-gov-blue-800" />
                          <span className="font-bold text-xs sm:text-sm text-slate-900">{docSpec.name}</span>
                          <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
                            {docSpec.category}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500">{docSpec.description}</p>
                        {uploaded && (
                          <div className="text-[11px] text-emerald-700 flex items-center gap-1.5 pt-1 font-mono">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                            <span>Uploaded ({uploaded.fileName || uploaded.id})</span>
                            {uploaded.sha256 && (
                              <span className="text-[10px] text-slate-400">
                                · SHA-256: {uploaded.sha256.slice(0, 12)}...
                              </span>
                            )}
                          </div>
                        )}
                      </div>

                      {!isLocked && (
                        <div className="shrink-0">
                          <label
                            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                              uploaded
                                ? 'bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200'
                                : 'bg-gov-blue-900 text-white hover:bg-gov-blue-800'
                            }`}
                          >
                            {isUploading ? (
                              <>
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                <span>Verifying...</span>
                              </>
                            ) : (
                              <>
                                <UploadCloud className="w-3.5 h-3.5" />
                                <span>{uploaded ? 'Replace PDF' : 'Upload PDF'}</span>
                              </>
                            )}
                            <input
                              type="file"
                              accept=".pdf,application/pdf"
                              disabled={isUploading}
                              className="hidden"
                              onChange={(e) => handleFileUpload(e, docSpec.docKey)}
                            />
                          </label>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </section>
        </div>

        {/* Bottom Actions */}
        {!isLocked && (
          <div className="p-4 bg-white rounded-xl border border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-xs text-slate-500">
              Ensure all required documents are attached. Submitting will execute automated OCR extraction and generate scrutiny tasks.
            </p>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                disabled={saving || submitting}
                onClick={handleSaveDraft}
                className="px-4 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-xs font-semibold text-slate-700 transition-colors"
              >
                Save Draft
              </button>
              <button
                type="button"
                disabled={saving || submitting}
                onClick={handleSubmitProfile}
                className="px-5 py-2 rounded-lg bg-gov-saffron hover:bg-orange-600 text-xs font-bold text-white transition-colors shadow-md"
              >
                Submit Profile for Review
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
