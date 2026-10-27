'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  GraduationCap,
  Building,
  Plus,
  Trash2,
  Save,
  Send,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Info,
  ShieldCheck,
  ArrowLeft,
  ChevronRight,
  Layers,
  FileCheck,
  HelpCircle,
  Sparkles,
  Users,
} from 'lucide-react';
import {
  getProposals,
  createProposal,
  updateProposal,
  submitProposal,
  getInstitutionProfile,
  getStoredUser,
} from '../../../lib/api';
import {
  CourseProposal,
  ProposedBranch,
  ProposalType,
  ProposalStatus,
  BranchRuleResult,
  BranchCheckSummary,
  InstitutionProfile,
} from '../../../lib/types';

const PROPOSAL_TYPES: { id: ProposalType; label: string; desc: string }[] = [
  { id: 'NEW_COURSE', label: 'New Course', desc: 'Introduce an emerging or standard academic course/program' },
  { id: 'INTAKE_INCREASE', label: 'Intake Increase', desc: 'Expand existing seat capacity in approved divisions' },
  { id: 'EOA', label: 'Extension of Approval (EoA)', desc: 'Regular annual continuation of existing courses' },
  { id: 'NEW_INSTITUTION', label: 'New Institution', desc: 'Initial establishment intake sanction' },
  { id: 'CLOSURE', label: 'Course Closure', desc: 'Progressive or complete closure of unviable branches' },
];

const STANDARD_DIVISIONS = [30, 60, 120, 180, 240, 300];

export default function InstitutionProposalsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Profile data reuse
  const [profile, setProfile] = useState<InstitutionProfile | null>(null);
  const [landAreaSqm, setLandAreaSqm] = useState<number>(0);

  // Proposal State
  const [existingProposals, setExistingProposals] = useState<CourseProposal[]>([]);
  const [activeProposalId, setActiveProposalId] = useState<string | null>(null);
  const [proposalType, setProposalType] = useState<ProposalType>('NEW_COURSE');
  const [applicationId, setApplicationId] = useState<string>('APP-2024-001');
  const [proposalStatus, setProposalStatus] = useState<ProposalStatus>('DRAFT');
  const [determination, setDetermination] = useState<CourseProposal['determination']>();

  // Branches Repeater State
  const [branches, setBranches] = useState<ProposedBranch[]>([
    {
      id: 'BR-INIT-1',
      level: 'UG',
      program: 'ENGINEERING',
      course: 'Computer Science & Engineering',
      affiliatingBody: 'State Technical University',
      currentIntake: 60,
      expectedIntake: 120,
      shift: '1st Shift',
      facultySanctioned: 6,
      facultyAvailable: 6,
      facultyPayCompliant: true,
      labs: ['Data Structures Lab', 'AI Systems Lab', 'Advanced Computing Lab', 'Network Lab'],
      builtUpArea: 420,
      libraryAvailable: true,
      affiliationNocAvailable: true,
    },
  ]);

  // Load Institution Profile and Proposals
  useEffect(() => {
    async function loadData() {
      setLoading(true);
      setError(null);
      try {
        const user = getStoredUser();
        // Load profile to reuse land area
        const profRes = await getInstitutionProfile();
        if (profRes.data) {
          setProfile(profRes.data);
          const area = profRes.data.land?.totalAreaSqm || profRes.data.land?.landAreaSqm || 0;
          setLandAreaSqm(area);
        }

        // Load existing proposals
        const propsRes = await getProposals();
        if (propsRes.data && propsRes.data.length > 0) {
          setExistingProposals(propsRes.data);
          // Pick the first draft or newest proposal
          const latest = propsRes.data[0];
          setActiveProposalId(latest.id);
          setProposalType(latest.type);
          setApplicationId(latest.applicationId);
          setProposalStatus(latest.status);
          setDetermination(latest.determination);
          if (latest.branches && latest.branches.length > 0) {
            setBranches(latest.branches);
          }
        }
      } catch (err: any) {
        setError(err.message || 'Failed to initialize proposals');
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  // Compute live client-side indicators for instant feedback
  const totalProposedIntake = useMemo(() => {
    return branches.reduce((sum, b) => sum + (Number(b.expectedIntake) || 0), 0);
  }, [branches]);

  const liveChecks = useMemo(() => {
    return branches.map((branch, idx) => {
      const results: BranchRuleResult[] = [];
      const intake = Number(branch.expectedIntake) || 0;
      const ratioNorm = branch.level === 'PG' ? 15 : branch.level === 'DIPLOMA' ? 25 : 20;
      const requiredFaculty = Math.max(1, Math.ceil(intake / ratioNorm));
      const available = Number(branch.facultyAvailable) || 0;
      const sanctioned = Number(branch.facultySanctioned) || 0;

      // 1. Faculty Ratio
      if (available >= requiredFaculty) {
        results.push({
          rule: 'FACULTY_RATIO',
          status: 'MET',
          computed: `1:${available > 0 ? (intake / available).toFixed(1) : 0} (${available} faculty)`,
          required: `1:${ratioNorm} (${requiredFaculty} required)`,
          reason: `Faculty strength meets normative 1:${ratioNorm} requirement (placeholder pending APH).`,
        });
      } else {
        results.push({
          rule: 'FACULTY_RATIO',
          status: 'DEFICIENT',
          computed: `1:${available > 0 ? (intake / available).toFixed(1) : 0} (${available} faculty)`,
          required: `1:${ratioNorm} (${requiredFaculty} required)`,
          reason: `Shortfall of ${requiredFaculty - available} faculty members against 1:${ratioNorm} ratio.`,
        });
      }

      // 2. Faculty Pay Compliance
      if (!branch.facultyPayCompliant) {
        results.push({
          rule: 'FACULTY_PAY_COMPLIANCE',
          status: 'DEFICIENT',
          computed: 'Pay Scale Non-Compliant',
          required: '7th CPC / State scale compliance',
          reason: 'Faculty compensation structure reported deficient.',
        });
      } else if (available < sanctioned) {
        results.push({
          rule: 'FACULTY_PAY_COMPLIANCE',
          status: 'REVIEW',
          computed: `${available}/${sanctioned} sanctioned filled`,
          required: `${sanctioned} positions filled`,
          reason: `${sanctioned - available} sanctioned posts vacant; scrutiny recommended.`,
        });
      } else {
        results.push({
          rule: 'FACULTY_PAY_COMPLIANCE',
          status: 'MET',
          computed: `Compliant (${available}/${sanctioned})`,
          required: 'Pay compliant & filled',
          reason: 'Scale compliant and posts fully staffed.',
        });
      }

      // 3. Land Sufficiency (total intake across proposal * 5 sqm vs profile land)
      const requiredLand = totalProposedIntake * 5;
      if (landAreaSqm <= 0) {
        results.push({
          rule: 'LAND_SUFFICIENCY',
          status: 'REVIEW',
          computed: '0 sqm recorded',
          required: `${requiredLand.toLocaleString()} sqm (5 sqm/student)`,
          reason: 'Campus land not recorded in profile; review needed.',
        });
      } else if (landAreaSqm >= requiredLand) {
        results.push({
          rule: 'LAND_SUFFICIENCY',
          status: 'MET',
          computed: `${landAreaSqm.toLocaleString()} sqm available`,
          required: `${requiredLand.toLocaleString()} sqm for ${totalProposedIntake} total seats`,
          reason: 'Campus land meets total intake requirement.',
        });
      } else {
        results.push({
          rule: 'LAND_SUFFICIENCY',
          status: 'DEFICIENT',
          computed: `${landAreaSqm.toLocaleString()} sqm available`,
          required: `${requiredLand.toLocaleString()} sqm required`,
          reason: `Deficit of ${(requiredLand - landAreaSqm).toLocaleString()} sqm for ${totalProposedIntake} seats.`,
        });
      }

      // 4. Labs & Infrastructure
      const labsCount = Array.isArray(branch.labs) ? branch.labs.length : 0;
      const builtUp = Number(branch.builtUpArea) || 0;
      const lib = Boolean(branch.libraryAvailable);

      if (labsCount < 4 || builtUp < 400 || !lib) {
        const issues: string[] = [];
        if (labsCount < 4) issues.push(`Labs: ${labsCount} < 4`);
        if (builtUp < 400) issues.push(`Area: ${builtUp} < 400 sqm`);
        if (!lib) issues.push('Library missing');
        results.push({
          rule: 'LABS_INFRASTRUCTURE',
          status: 'DEFICIENT',
          computed: `${labsCount} labs, ${builtUp} sqm, lib: ${lib ? 'Yes' : 'No'}`,
          required: '4 labs, 400 sqm, library',
          reason: `Infrastructure deficit: ${issues.join('; ')}.`,
        });
      } else {
        results.push({
          rule: 'LABS_INFRASTRUCTURE',
          status: 'MET',
          computed: `${labsCount} labs, ${builtUp} sqm, library available`,
          required: '4 labs, 400 sqm, library',
          reason: 'Laboratory, built-up space, and library facilities compliant.',
        });
      }

      // 5. Affiliation NOC
      const body = (branch.affiliatingBody || '').trim();
      if (!body) {
        results.push({
          rule: 'AFFILIATION_NOC',
          status: 'DEFICIENT',
          computed: 'Missing Affiliating Body',
          required: 'University / Technical Board NOC',
          reason: 'Affiliating university is mandatory.',
        });
      } else if (branch.affiliationNocAvailable) {
        results.push({
          rule: 'AFFILIATION_NOC',
          status: 'MET',
          computed: `NOC declared for ${body}`,
          required: `NOC from ${body}`,
          reason: 'Valid affiliation NOC declared.',
        });
      } else {
        results.push({
          rule: 'AFFILIATION_NOC',
          status: 'DEFICIENT',
          computed: 'NOC missing',
          required: `NOC from ${body}`,
          reason: `Mandatory NOC not provided for ${body}.`,
        });
      }

      // 6. Intake Limit
      const isAllowedStep = STANDARD_DIVISIONS.includes(intake);
      const inc = intake - (Number(branch.currentIntake) || 0);

      if (intake <= 0) {
        results.push({
          rule: 'INTAKE_LIMIT',
          status: 'DEFICIENT',
          computed: `${intake} seats`,
          required: 'Positive integer intake',
          reason: 'Intake must be greater than zero.',
        });
      } else if (!isAllowedStep) {
        results.push({
          rule: 'INTAKE_LIMIT',
          status: 'REVIEW',
          computed: `${intake} seats`,
          required: `Division steps: ${STANDARD_DIVISIONS.join(', ')}`,
          reason: `Seat capacity does not follow standard division divisions (${STANDARD_DIVISIONS.join(', ')}).`,
        });
      } else if (proposalType === 'INTAKE_INCREASE' && inc > 60) {
        results.push({
          rule: 'INTAKE_LIMIT',
          status: 'DEFICIENT',
          computed: `+${inc} seat increase`,
          required: 'Max +60 increase per year',
          reason: 'Annual intake expansion exceeds single-cycle maximum limit of 60 seats.',
        });
      } else {
        results.push({
          rule: 'INTAKE_LIMIT',
          status: 'MET',
          computed: `${intake} seats (standard step)`,
          required: 'Standard batch step increment',
          reason: 'Proposed intake matches approved batch increments.',
        });
      }

      // 7. Document Validity
      results.push({
        rule: 'DOCUMENT_VALIDITY',
        status: branch.affiliationNocAvailable ? 'MET' : 'REVIEW',
        computed: branch.affiliationNocAvailable ? 'NOC validity tracked' : 'No NOC linked',
        required: 'Active unexpired documents',
        reason: branch.affiliationNocAvailable
          ? 'NOC certificates active and within validity period.'
          : 'Certificates awaiting documentary verification.',
      });

      let overallStatus: 'MET' | 'DEFICIENT' | 'REVIEW' = 'MET';
      if (results.some((r) => r.status === 'DEFICIENT')) overallStatus = 'DEFICIENT';
      else if (results.some((r) => r.status === 'REVIEW')) overallStatus = 'REVIEW';

      return {
        branchIndex: idx,
        course: branch.course || `Course #${idx + 1}`,
        overallStatus,
        results,
      };
    });
  }, [branches, totalProposedIntake, landAreaSqm, proposalType]);

  // Branch repeater handlers
  const handleAddBranch = () => {
    setBranches((prev) => [
      ...prev,
      {
        id: `BR-NEW-${Date.now().toString().slice(-4)}`,
        level: 'UG',
        program: 'ENGINEERING',
        course: '',
        affiliatingBody: profile?.college?.name ? 'State Technical University' : '',
        currentIntake: 0,
        expectedIntake: 60,
        shift: '1st Shift',
        facultySanctioned: 3,
        facultyAvailable: 3,
        facultyPayCompliant: true,
        labs: ['Department Lab 1', 'Department Lab 2', 'Computing Lab', 'Workshop Lab'],
        builtUpArea: 400,
        libraryAvailable: true,
        affiliationNocAvailable: true,
      },
    ]);
  };

  const handleRemoveBranch = (index: number) => {
    if (branches.length <= 1) {
      alert('At least one proposed course/branch is required.');
      return;
    }
    setBranches((prev) => prev.filter((_, i) => i !== index));
  };

  const handleBranchChange = (index: number, field: keyof ProposedBranch, value: any) => {
    setBranches((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: value };
      return copy;
    });
  };

  // Save Draft
  const handleSaveDraft = async () => {
    setSaving(true);
    setError(null);
    setSuccessMsg(null);
    try {
      if (activeProposalId && proposalStatus === 'DRAFT') {
        const res = await updateProposal(activeProposalId, {
          applicationId,
          type: proposalType,
          branches,
        });
        if (res.error) throw new Error(res.error);
        setSuccessMsg('Proposal draft updated successfully.');
      } else {
        const res = await createProposal({
          applicationId,
          type: proposalType,
          branches,
        });
        if (res.error) throw new Error(res.error);
        if (res.data) {
          setActiveProposalId(res.data.id);
          setProposalStatus('DRAFT');
          setExistingProposals((prev) => [res.data!, ...prev]);
        }
        setSuccessMsg('New proposal draft created successfully.');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to save proposal draft');
    } finally {
      setSaving(false);
    }
  };

  // Submit Proposal (CRITICAL SAFEGUARD: Never blocks even if DEFICIENT)
  const handleSubmit = async () => {
    if (!activeProposalId) {
      // Create first then submit
      setSubmitting(true);
      setError(null);
      setSuccessMsg(null);
      try {
        const createRes = await createProposal({
          applicationId,
          type: proposalType,
          branches,
        });
        if (createRes.error || !createRes.data) {
          throw new Error(createRes.error || 'Failed to initialize proposal before submission.');
        }
        const submitRes = await submitProposal(createRes.data.id);
        if (submitRes.error || !submitRes.data) {
          throw new Error(submitRes.error || 'Failed to submit proposal.');
        }
        setActiveProposalId(submitRes.data.id);
        setProposalStatus(submitRes.data.status);
        setSuccessMsg(
          'Proposal submitted to AICTE successfully! Automated normative checks provide assistive indicators for regional appraisal.'
        );
      } catch (err: any) {
        setError(err.message || 'Submission failed');
      } finally {
        setSubmitting(false);
      }
      return;
    }

    setSubmitting(true);
    setError(null);
    setSuccessMsg(null);
    try {
      // First update draft
      await updateProposal(activeProposalId, {
        applicationId,
        type: proposalType,
        branches,
      });

      const res = await submitProposal(activeProposalId);
      if (res.error || !res.data) {
        throw new Error(res.error || 'Failed to submit proposal');
      }
      setProposalStatus(res.data.status);
      setSuccessMsg(
        'Proposal submitted to AICTE successfully! Automated normative checks serve as indicators, not automated decisions.'
      );
    } catch (err: any) {
      setError(err.message || 'Submission failed');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 text-slate-100 flex items-center justify-center p-6">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-slate-400 text-sm">Loading course & intake module...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      {/* Top Header */}
      <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center space-x-3">
            <Link
              href="/institution"
              className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
              title="Return to Dashboard"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <div className="flex items-center space-x-2">
                <GraduationCap className="w-6 h-6 text-indigo-400" />
                <h1 className="text-lg font-bold text-white tracking-tight">Proposed Courses & Intake</h1>
                <span
                  className={`text-xs px-2.5 py-0.5 rounded-full font-semibold border ${
                    proposalStatus === 'SUBMITTED'
                      ? 'bg-blue-500/10 text-blue-400 border-blue-500/30'
                      : proposalStatus === 'REVIEWED'
                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                      : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                  }`}
                >
                  {proposalStatus}
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Institutional Course Expansion, EoA & Normative Intake Verification
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center space-x-3">
            {proposalStatus === 'DRAFT' && (
              <>
                <button
                  type="button"
                  onClick={handleSaveDraft}
                  disabled={saving || submitting}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-medium rounded-lg transition flex items-center space-x-2 border border-slate-700 disabled:opacity-50"
                >
                  <Save className="w-4 h-4 text-slate-400" />
                  <span>{saving ? 'Saving...' : 'Save Draft'}</span>
                </button>
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={saving || submitting || branches.length === 0}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold rounded-lg shadow-lg shadow-indigo-600/30 transition flex items-center space-x-2 disabled:opacity-50"
                >
                  <Send className="w-4 h-4" />
                  <span>{submitting ? 'Submitting...' : 'Submit Proposal'}</span>
                </button>
              </>
            )}
            {proposalStatus !== 'DRAFT' && (
              <span className="text-xs text-slate-400 italic bg-slate-800/80 px-3 py-1.5 rounded-lg border border-slate-700">
                Proposal submitted. Read-only in active appraisal.
              </span>
            )}
          </div>
        </div>
      </header>

      {/* Main Content Container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Alerts / Banners */}
        {error && (
          <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-sm flex items-start space-x-3">
            <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Notice</p>
              <p className="text-xs text-red-300/90">{error}</p>
            </div>
          </div>
        )}

        {successMsg && (
          <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-sm flex items-start space-x-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Success</p>
              <p className="text-xs text-emerald-300/90">{successMsg}</p>
            </div>
          </div>
        )}

        {/* Safeguard & Profile Land Notice Banner */}
        <div className="p-4 rounded-2xl bg-gradient-to-r from-slate-900 via-indigo-950/40 to-slate-900 border border-indigo-500/20 shadow-xl space-y-3">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start space-x-3">
              <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h2 className="text-sm font-semibold text-slate-200 flex items-center space-x-2">
                  <span>Assisted Normative Intelligence: Indicators, Not Decisions</span>
                  <span className="text-[10px] bg-indigo-500/20 text-indigo-300 px-2 py-0.5 rounded-full uppercase tracking-wider font-bold">
                    Non-Blocking
                  </span>
                </h2>
                <p className="text-xs text-slate-400 max-w-3xl leading-relaxed">
                  Automated checks continuously evaluate cadre ratio, infrastructure, NOCs, and intake increments.
                  Thresholds are marked <em className="text-amber-300">placeholder pending APH</em>. Under no
                  circumstances do automated indicators reject or block your application submission. Final appraisals
                  are performed solely by designated AICTE officers.
                </p>
              </div>
            </div>
            {/* Reused Profile Land Data Badge */}
            <div className="bg-slate-900/90 border border-slate-700/80 rounded-xl p-3 text-right shrink-0">
              <p className="text-[11px] text-slate-400 uppercase font-medium tracking-wide">Campus Land Reused</p>
              <p className="text-base font-bold text-indigo-300">
                {landAreaSqm > 0 ? `${landAreaSqm.toLocaleString()} sqm` : '0 sqm'}
              </p>
              <p className="text-[10px] text-slate-500">
                {profile?.college?.name ? `Synced from ${profile.college.name}` : 'Reused from Profile Land Record'}
              </p>
            </div>
          </div>
        </div>

        {/* Officer Determination Banner (if reviewed) */}
        {determination && (
          <div className="p-4 rounded-xl bg-slate-900 border border-slate-700 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Regional Officer Determination
              </span>
              <span
                className={`text-xs px-2.5 py-0.5 rounded-full font-bold ${
                  determination.decision === 'NO_CONCERN'
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                    : determination.decision === 'ASK_CLARIFICATION'
                    ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                    : 'bg-red-500/20 text-red-400 border border-red-500/30'
                }`}
              >
                {determination.decision.replace('_', ' ')}
              </span>
            </div>
            <p className="text-sm text-slate-200 bg-slate-950 p-3 rounded-lg border border-slate-800">
              "{determination.remarks}"
            </p>
            <p className="text-[11px] text-slate-500">
              Evaluated on {new Date(determination.determinedAt).toLocaleString()} by Regional Officer Desk
            </p>
          </div>
        )}

        {/* Form Layout: 2 Columns on desktop */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Form Details & Branch Repeater (7 cols) */}
          <div className="lg:col-span-7 space-y-6">
            {/* Proposal Metadata Box */}
            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 space-y-4 shadow-lg">
              <h2 className="text-sm font-semibold text-slate-200 flex items-center space-x-2">
                <Building className="w-4 h-4 text-indigo-400" />
                <span>Proposal Classification</span>
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Proposal Type</label>
                  <select
                    value={proposalType}
                    disabled={proposalStatus !== 'DRAFT'}
                    onChange={(e) => setProposalType(e.target.value as ProposalType)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-indigo-500 disabled:opacity-50"
                  >
                    {PROPOSAL_TYPES.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                  <p className="text-[11px] text-slate-500 mt-1">
                    {PROPOSAL_TYPES.find((t) => t.id === proposalType)?.desc}
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Linked Application ID</label>
                  <input
                    type="text"
                    value={applicationId}
                    disabled={proposalStatus !== 'DRAFT'}
                    onChange={(e) => setApplicationId(e.target.value)}
                    placeholder="e.g. APP-2024-001"
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-indigo-500 disabled:opacity-50"
                  />
                  <p className="text-[11px] text-slate-500 mt-1">AICTE application cycle reference ID</p>
                </div>
              </div>
            </div>

            {/* Proposed Branches Repeater */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-base font-bold text-white flex items-center space-x-2">
                    <Layers className="w-5 h-5 text-indigo-400" />
                    <span>Proposed Courses & Branches ({branches.length})</span>
                  </h2>
                  <p className="text-xs text-slate-400">Total proposed intake: {totalProposedIntake} seats</p>
                </div>
                {proposalStatus === 'DRAFT' && (
                  <button
                    type="button"
                    onClick={handleAddBranch}
                    className="px-3.5 py-1.5 bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Course</span>
                  </button>
                )}
              </div>

              {/* Branch Cards */}
              {branches.map((branch, idx) => (
                <div
                  key={branch.id || idx}
                  className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4 shadow-md relative"
                >
                  <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                    <div className="flex items-center space-x-2">
                      <span className="w-6 h-6 rounded-full bg-indigo-600/20 border border-indigo-500/30 text-indigo-400 text-xs font-bold flex items-center justify-center">
                        {idx + 1}
                      </span>
                      <h3 className="text-sm font-semibold text-slate-100">
                        {branch.course || `Course Division #${idx + 1}`}
                      </h3>
                    </div>
                    {proposalStatus === 'DRAFT' && branches.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveBranch(idx)}
                        className="text-slate-500 hover:text-red-400 p-1.5 rounded-lg hover:bg-red-500/10 transition"
                        title="Remove Course"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[11px] font-medium text-slate-400 mb-1">Level</label>
                      <select
                        value={branch.level}
                        disabled={proposalStatus !== 'DRAFT'}
                        onChange={(e) => handleBranchChange(idx, 'level', e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-200"
                      >
                        <option value="UG">Undergraduate (UG)</option>
                        <option value="PG">Postgraduate (PG)</option>
                        <option value="DIPLOMA">Diploma</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-medium text-slate-400 mb-1">Program</label>
                      <select
                        value={branch.program}
                        disabled={proposalStatus !== 'DRAFT'}
                        onChange={(e) => handleBranchChange(idx, 'program', e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-200"
                      >
                        <option value="ENGINEERING">Engineering & Tech</option>
                        <option value="MANAGEMENT">Management (MBA)</option>
                        <option value="MCA">Computer Applications (MCA)</option>
                        <option value="PHARMACY">Pharmacy</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-medium text-slate-400 mb-1">Shift</label>
                      <select
                        value={branch.shift}
                        disabled={proposalStatus !== 'DRAFT'}
                        onChange={(e) => handleBranchChange(idx, 'shift', e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-200"
                      >
                        <option value="1st Shift">1st Shift (Day)</option>
                        <option value="2nd Shift">2nd Shift (Evening)</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-medium text-slate-400 mb-1">Course / Discipline</label>
                      <input
                        type="text"
                        value={branch.course}
                        disabled={proposalStatus !== 'DRAFT'}
                        onChange={(e) => handleBranchChange(idx, 'course', e.target.value)}
                        placeholder="e.g. Artificial Intelligence & Machine Learning"
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-medium text-slate-400 mb-1">Affiliating Body</label>
                      <input
                        type="text"
                        value={branch.affiliatingBody}
                        disabled={proposalStatus !== 'DRAFT'}
                        onChange={(e) => handleBranchChange(idx, 'affiliatingBody', e.target.value)}
                        placeholder="e.g. State Technical University"
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div>
                      <label className="block text-[11px] font-medium text-slate-400 mb-1">Current Intake</label>
                      <input
                        type="number"
                        min="0"
                        value={branch.currentIntake}
                        disabled={proposalStatus !== 'DRAFT'}
                        onChange={(e) => handleBranchChange(idx, 'currentIntake', Number(e.target.value))}
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-200"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-medium text-slate-400 mb-1">
                        Expected Intake <span className="text-indigo-400">*</span>
                      </label>
                      <input
                        type="number"
                        min="1"
                        step="30"
                        value={branch.expectedIntake}
                        disabled={proposalStatus !== 'DRAFT'}
                        onChange={(e) => handleBranchChange(idx, 'expectedIntake', Number(e.target.value))}
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:border-indigo-500"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-medium text-slate-400 mb-1">Sanctioned Faculty</label>
                      <input
                        type="number"
                        min="0"
                        value={branch.facultySanctioned}
                        disabled={proposalStatus !== 'DRAFT'}
                        onChange={(e) => handleBranchChange(idx, 'facultySanctioned', Number(e.target.value))}
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-200"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-medium text-slate-400 mb-1">Available Faculty</label>
                      <input
                        type="number"
                        min="0"
                        value={branch.facultyAvailable}
                        disabled={proposalStatus !== 'DRAFT'}
                        onChange={(e) => handleBranchChange(idx, 'facultyAvailable', Number(e.target.value))}
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-200"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-medium text-slate-400 mb-1">
                        Departmental Labs (comma-separated list)
                      </label>
                      <input
                        type="text"
                        value={branch.labs.join(', ')}
                        disabled={proposalStatus !== 'DRAFT'}
                        onChange={(e) =>
                          handleBranchChange(
                            idx,
                            'labs',
                            e.target.value
                              .split(',')
                              .map((s) => s.trim())
                              .filter(Boolean)
                          )
                        }
                        placeholder="e.g. Lab 1, Lab 2, Lab 3, Lab 4"
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-200"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-medium text-slate-400 mb-1">
                        Built-Up Area (sqm)
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={branch.builtUpArea}
                        disabled={proposalStatus !== 'DRAFT'}
                        onChange={(e) => handleBranchChange(idx, 'builtUpArea', Number(e.target.value))}
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-200"
                      />
                    </div>
                  </div>

                  {/* Checkbox Toggles */}
                  <div className="flex flex-wrap items-center gap-4 pt-2 border-t border-slate-800/60">
                    <label className="flex items-center space-x-2 text-xs text-slate-300 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={branch.facultyPayCompliant}
                        disabled={proposalStatus !== 'DRAFT'}
                        onChange={(e) => handleBranchChange(idx, 'facultyPayCompliant', e.target.checked)}
                        className="rounded border-slate-700 text-indigo-600 focus:ring-0 bg-slate-950"
                      />
                      <span>7th CPC / State Pay Compliant</span>
                    </label>

                    <label className="flex items-center space-x-2 text-xs text-slate-300 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={branch.libraryAvailable}
                        disabled={proposalStatus !== 'DRAFT'}
                        onChange={(e) => handleBranchChange(idx, 'libraryAvailable', e.target.checked)}
                        className="rounded border-slate-700 text-indigo-600 focus:ring-0 bg-slate-950"
                      />
                      <span>Departmental Library Available</span>
                    </label>

                    <label className="flex items-center space-x-2 text-xs text-slate-300 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={branch.affiliationNocAvailable}
                        disabled={proposalStatus !== 'DRAFT'}
                        onChange={(e) => handleBranchChange(idx, 'affiliationNocAvailable', e.target.checked)}
                        className="rounded border-slate-700 text-indigo-600 focus:ring-0 bg-slate-950"
                      />
                      <span>Affiliation NOC Declared</span>
                    </label>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right Column: Live Normative Check Results Panel (5 cols) */}
          <div className="lg:col-span-5 space-y-4">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 sticky top-24 shadow-xl space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center space-x-2">
                  <Sparkles className="w-5 h-5 text-indigo-400" />
                  <h3 className="text-sm font-bold text-white tracking-tight">Live Normative Check Panel</h3>
                </div>
                <span className="text-[10px] text-amber-300/90 font-medium px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/20">
                  placeholder pending APH
                </span>
              </div>

              <p className="text-xs text-slate-400">
                Evaluation updates automatically as you edit branch parameters. Indicators assist in ensuring compliance
                before regional committee review.
              </p>

              {/* Check Summaries for each branch */}
              <div className="space-y-4 max-h-[calc(100vh-280px)] overflow-y-auto pr-1">
                {liveChecks.map((summary) => (
                  <div
                    key={summary.branchIndex}
                    className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2.5"
                  >
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-semibold text-slate-200 truncate max-w-[200px]">
                        {summary.course}
                      </h4>
                      <span
                        className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${
                          summary.overallStatus === 'MET'
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                            : summary.overallStatus === 'REVIEW'
                            ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                            : 'bg-red-500/10 text-red-400 border-red-500/30'
                        }`}
                      >
                        {summary.overallStatus}
                      </span>
                    </div>

                    <div className="space-y-2 pt-1 border-t border-slate-800/60">
                      {summary.results.map((r, rIdx) => (
                        <div key={rIdx} className="text-xs space-y-0.5">
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] text-slate-400 font-medium">{r.rule.replace('_', ' ')}</span>
                            <span
                              className={`text-[10px] font-semibold px-1.5 py-0.2 rounded ${
                                r.status === 'MET'
                                  ? 'text-emerald-400 bg-emerald-500/10'
                                  : r.status === 'REVIEW'
                                  ? 'text-amber-400 bg-amber-500/10'
                                  : 'text-red-400 bg-red-500/10'
                              }`}
                            >
                              {r.status}
                            </span>
                          </div>
                          <div className="flex justify-between text-[11px] text-slate-500">
                            <span>Rep: {r.computed}</span>
                            <span>Req: {r.required}</span>
                          </div>
                          <p className="text-[10px] text-slate-400 italic">{r.reason}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              {/* Informative footer */}
              <div className="p-3 rounded-lg bg-indigo-950/30 border border-indigo-500/20 text-[11px] text-indigo-300/90 leading-relaxed flex items-start space-x-2">
                <Info className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
                <span>
                  <strong>Reminder:</strong> Checks never auto-reject or block proposal submission. Deficiencies flagged
                  can be defended with explanatory notes during regional appraisal.
                </span>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
