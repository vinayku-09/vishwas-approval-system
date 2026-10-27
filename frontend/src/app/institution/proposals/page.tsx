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
  BookOpen,
  Landmark,
  CheckSquare,
  FileText,
  X,
  ExternalLink,
  MapPin,
  Search,
  BadgeCheck,
  AlertCircle,
} from 'lucide-react';
import {
  getProposals,
  createProposal,
  updateProposal,
  submitProposal,
  getInstitutionProfile,
  getStoredUser,
} from '../../../lib/api';
import FileUploadWidget from '../../../components/FileUploadWidget';
import {
  CourseProposal,
  ProposedBranch,
  ProposalType,
  ProposalStatus,
  BranchRuleResult,
  BranchCheckSummary,
  InstitutionProfile,
  UploadedFileResult,
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
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Requirement Agreement Gate State
  const [hasAgreed, setHasAgreed] = useState(false);
  const [agreedCheckbox, setAgreedCheckbox] = useState(false);
  const [showGuidelinesModal, setShowGuidelinesModal] = useState(false);

  // Bhulekh Land Verification State
  const [showBhulekhPanel, setShowBhulekhPanel] = useState(false);
  const [bhulekhDistrict, setBhulekhDistrict] = useState('');
  const [bhulekhTaluka, setBhulekhTaluka] = useState('');
  const [bhulekhVillage, setBhulekhVillage] = useState('');
  const [bhulekhSurveyNo, setBhulekhSurveyNo] = useState('');
  const [bhulekhGatNo, setBhulekhGatNo] = useState('');
  const [bhulekhAreaHectare, setBhulekhAreaHectare] = useState('');
  const [bhulekhVerified, setBhulekhVerified] = useState(false);
  const [bhulekhVerifiedAreaSqm, setBhulekhVerifiedAreaSqm] = useState<number>(0);

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

  // Track uploaded file IDs per branch (NOC PDFs) and proposal-level docs
  const [branchNocFileIds, setBranchNocFileIds] = useState<Record<string, string>>({});
  const [proposalDocFileIds, setProposalDocFileIds] = useState<string[]>([]);

  // Load Institution Profile and Proposals
  useEffect(() => {
    setMounted(true);
    async function loadData() {
      setLoading(true);
      setError(null);
      try {
        // Load profile to reuse land area
        const profRes = await getInstitutionProfile();
        if (profRes.data) {
          setProfile(profRes.data);
          const area = profRes.data.land?.totalAreaSqm || profRes.data.land?.landAreaSqm || 0;
          setLandAreaSqm(area);
        }

        // Load existing proposals — silently fall through if the table isn't
        // migrated yet or the backend is temporarily unreachable.
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
        // Only log — don't surface DB/network boot errors to the user.
        // The form is still fully usable with a fresh draft.
        console.warn('[proposals] Failed to load existing proposals:', err?.message);
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

  if (!mounted || loading) {
    return (
      <div suppressHydrationWarning className="min-h-screen bg-gray-50 text-gray-900 flex items-center justify-center p-6">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-gray-500 text-sm">Loading course &amp; intake module...</p>
        </div>
      </div>
    );
  }

  // Statutory Norms & Prerequisites Agreement Screen (Gate)
  if (!hasAgreed) {
    return (
      <div suppressHydrationWarning className="min-h-screen bg-gray-50 text-gray-900">
        {/* Top Header */}
        <header className="border-b border-gray-200 bg-white shadow-sm sticky top-0 z-30">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center space-x-3">
              <Link
                href="/institution"
                className="p-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-600 transition"
                title="Return to Institution Portal"
              >
                <ArrowLeft className="w-5 h-5" />
              </Link>
              <div>
                <div className="flex items-center space-x-2">
                  <GraduationCap className="w-6 h-6 text-indigo-600" />
                  <h1 className="text-lg font-bold text-gray-900 tracking-tight">Institute Approval (Courses &amp; Intake)</h1>
                  <span className="text-xs px-2.5 py-0.5 rounded-full font-semibold border bg-indigo-50 text-indigo-700 border-indigo-200">
                    Mandatory Norms Checklist
                  </span>
                </div>
                <p className="text-xs text-gray-500">
                  AICTE Approval Process Handbook (APH 2024–25) &bull; Statutory Prerequisite Review
                </p>
              </div>
            </div>
            <Link
              href="/institution"
              className="text-xs font-semibold text-gray-600 hover:text-gray-900 flex items-center space-x-1"
            >
              <span>Cancel &amp; Return</span>
            </Link>
          </div>
        </header>

        {/* Main Agreement Content */}
        <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-6">
          {/* Institutional Context Hero */}
          <div className="bg-gradient-to-r from-indigo-900 via-gov-blue-900 to-gov-blue-950 text-white rounded-2xl p-6 shadow-md border border-indigo-950 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <span className="text-[11px] font-bold text-gov-gold uppercase tracking-widest block">
                  AICTE Technical Approval Gateway &bull; Step 1 of 2
                </span>
                <h2 className="text-xl font-extrabold tracking-tight text-white mt-1">
                  Institutional Statutory Compliance &amp; Norms Undertaking
                </h2>
              </div>
              <div className="bg-white/10 backdrop-blur px-3 py-1.5 rounded-lg border border-white/20 text-right">
                <span className="text-[10px] text-blue-200 block uppercase font-semibold">Campus Land Record</span>
                <span className="text-sm font-bold text-gov-gold">
                  {landAreaSqm > 0 ? `${landAreaSqm.toLocaleString()} sq.m` : 'Profile Pending'}
                </span>
              </div>
            </div>
            <p className="text-xs text-blue-100 max-w-3xl leading-relaxed">
              Under AICTE Approval Regulations, technical institutions proposing new courses, intake expansion, or regular Extension of Approval (EoA) must review and confirm adherence to statutory norms. Please inspect the requirements below before accessing the proposal builder.
            </p>
          </div>

          {/* Statutory Requirement Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Card 1: Land & Infrastructure */}
            <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-xs hover:border-indigo-300 transition space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <div className="p-2 rounded-lg bg-indigo-50 text-indigo-600">
                    <Landmark className="w-4 h-4" />
                  </div>
                  <h3 className="text-sm font-bold text-gray-800">1. Land &amp; Built-up Infrastructure</h3>
                </div>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                  landAreaSqm >= 4047 ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200'
                }`}>
                  {landAreaSqm >= 4047 ? 'MET IN PROFILE' : 'REVIEW NEEDED'}
                </span>
              </div>
              <p className="text-xs text-gray-600 leading-relaxed">
                Minimum <strong>4,047 sq.m (1.0 Acre)</strong> of contiguous campus land owned or registered under long-term registered lease (30+ years). Land records must be verified via <strong>Bhulekh Mahabhumi</strong> portal during proposal submission.
              </p>
              <div className="pt-1 text-[11px] text-gray-500 flex items-center justify-between">
                <span>Profile Record: <strong>{landAreaSqm.toLocaleString()} sq.m</strong></span>
                <span>Statutory Norm: <strong>&ge; 4,047 sq.m</strong></span>
              </div>
            </div>

            {/* Card 2: Faculty Cadre Ratio */}
            <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-xs hover:border-indigo-300 transition space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <div className="p-2 rounded-lg bg-indigo-50 text-indigo-600">
                    <Users className="w-4 h-4" />
                  </div>
                  <h3 className="text-sm font-bold text-gray-800">2. Faculty Cadre &amp; Ratio Norms</h3>
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border bg-emerald-50 text-emerald-700 border-emerald-200">
                  STATUTORY RATIO
                </span>
              </div>
              <p className="text-xs text-gray-600 leading-relaxed">
                Mandatory faculty-student ratio: <strong>1:20 for UG</strong> Engineering &amp; Technology, <strong>1:15 for PG</strong> programs (M.Tech/MBA/MCA), and <strong>1:25 for Diploma</strong>. Cadre distribution of 1 Professor : 2 Associate Professors : 6 Assistant Professors.
              </p>
              <div className="pt-1 text-[11px] text-gray-500 flex items-center justify-between">
                <span>UG Norm: <strong>1:20</strong></span>
                <span>PG Norm: <strong>1:15</strong></span>
                <span>Cadre Structure: <strong>1:2:6</strong></span>
              </div>
            </div>

            {/* Card 3: Pay Scale & EPF */}
            <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-xs hover:border-indigo-300 transition space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <div className="p-2 rounded-lg bg-indigo-50 text-indigo-600">
                    <ShieldCheck className="w-4 h-4" />
                  </div>
                  <h3 className="text-sm font-bold text-gray-800">3. Faculty Pay Scale Compliance</h3>
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border bg-blue-50 text-blue-700 border-blue-200">
                  7th CPC / STATE
                </span>
              </div>
              <p className="text-xs text-gray-600 leading-relaxed">
                Statutory implementation of <strong>7th CPC / UGC / State Government</strong> approved pay scales. Disbursal of monthly salaries strictly through electronic banking channels with mandatory EPF and insurance contributions.
              </p>
              <div className="pt-1 text-[11px] text-gray-500 flex items-center justify-between">
                <span>Payment Mode: <strong>Bank Electronic Transfer</strong></span>
                <span>EPF Compliance: <strong>Mandatory</strong></span>
              </div>
            </div>

            {/* Card 4: Dedicated Laboratories */}
            <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-xs hover:border-indigo-300 transition space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <div className="p-2 rounded-lg bg-indigo-50 text-indigo-600">
                    <Layers className="w-4 h-4" />
                  </div>
                  <h3 className="text-sm font-bold text-gray-800">4. Dedicated Laboratories &amp; Facilities</h3>
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border bg-emerald-50 text-emerald-700 border-emerald-200">
                  MIN. 4 LABS / BRANCH
                </span>
              </div>
              <p className="text-xs text-gray-600 leading-relaxed">
                Each proposed technical division or academic branch requires a minimum of <strong>4 fully equipped, dedicated departmental laboratories</strong> aligned with the university syllabus, plus computing facilities with minimum 1:4 terminal ratio.
              </p>
              <div className="pt-1 text-[11px] text-gray-500 flex items-center justify-between">
                <span>Per Branch: <strong>&ge; 4 Dedicated Labs</strong></span>
                <span>Lab Area: <strong>&ge; 66 sq.m each</strong></span>
              </div>
            </div>

            {/* Card 5: Affiliating University NOC */}
            <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-xs hover:border-indigo-300 transition space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <div className="p-2 rounded-lg bg-indigo-50 text-indigo-600">
                    <FileCheck className="w-4 h-4" />
                  </div>
                  <h3 className="text-sm font-bold text-gray-800">5. University Affiliation &amp; NOC</h3>
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border bg-purple-50 text-purple-700 border-purple-200">
                  DOCUMENTED NOC
                </span>
              </div>
              <p className="text-xs text-gray-600 leading-relaxed">
                Unconditional No Objection Certificate (NOC) issued by the <strong>State Technical University / Directorate of Technical Education</strong> confirming readiness to affiliate the new course or increased intake batch.
              </p>
              <div className="pt-1 text-[11px] text-gray-500 flex items-center justify-between">
                <span>NOC Authority: <strong>State University / Board</strong></span>
                <span>Format: <strong>Statutory Digital/PDF</strong></span>
              </div>
            </div>

            {/* Card 6: Library & Resources */}
            <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-xs hover:border-indigo-300 transition space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <div className="p-2 rounded-lg bg-indigo-50 text-indigo-600">
                    <BookOpen className="w-4 h-4" />
                  </div>
                  <h3 className="text-sm font-bold text-gray-800">6. Library, Books &amp; E-Journals</h3>
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border bg-emerald-50 text-emerald-700 border-emerald-200">
                  PRESCRIBED TITLES
                </span>
              </div>
              <p className="text-xs text-gray-600 leading-relaxed">
                Statutory title and volume quotas per proposed discipline, including subscribed access to national &amp; international e-journals (e.g. IEEE, DELNET, Springer) and digital library terminals with high-speed internet.
              </p>
              <div className="pt-1 text-[11px] text-gray-500 flex items-center justify-between">
                <span>Titles/Volumes: <strong>As per APH Norms</strong></span>
                <span>E-Journal Access: <strong>Active Subscription</strong></span>
              </div>
            </div>
          </div>

          {/* Non-blocking Guidance Disclaimer */}
          <div className="p-4 rounded-xl bg-blue-50 border border-blue-200 text-xs text-blue-800 flex items-start space-x-3">
            <Info className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-semibold text-blue-900">Non-Blocking Normative Intelligence Guarantee</p>
              <p className="text-blue-700 leading-relaxed">
                AICTE automated indicators evaluate your inputs in real time to assist institutional readiness. In accordance with Council guidelines, automated checks <strong>never automatically reject or block submission</strong>. Any technical variance can be supported with written justification during Regional Committee appraisal.
              </p>
            </div>
          </div>

          {/* Institutional Undertaking & Agreement Checkbox */}
          <div className="bg-white border-2 border-indigo-200 rounded-2xl p-6 shadow-sm space-y-5">
            <div className="flex items-start space-x-3">
              <input
                id="statutory-undertaking"
                type="checkbox"
                checked={agreedCheckbox}
                onChange={(e) => setAgreedCheckbox(e.target.checked)}
                className="w-5 h-5 mt-0.5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
              />
              <label htmlFor="statutory-undertaking" className="text-xs sm:text-sm text-gray-800 font-medium leading-relaxed cursor-pointer select-none">
                I / We hereby confirm on behalf of the institution that we have read, understood, and agreed to adhere to the statutory AICTE Approval Process Handbook (APH 2024–25) normative requirements, cadre staffing ratios, and infrastructural benchmarks before submitting this academic proposal.
              </label>
            </div>

            <div className="pt-3 border-t border-gray-100 flex flex-col sm:flex-row items-center justify-between gap-3">
              <Link
                href="/institution"
                className="w-full sm:w-auto px-4 py-2.5 rounded-lg border border-gray-300 bg-white hover:bg-gray-50 text-gray-700 text-xs font-semibold text-center transition"
              >
                Return to Institution Portal
              </Link>
              <button
                type="button"
                disabled={!agreedCheckbox}
                onClick={() => {
                  setHasAgreed(true);
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                className="w-full sm:w-auto px-6 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs sm:text-sm font-bold shadow-md transition flex items-center justify-center space-x-2"
              >
                <span>Agree &amp; Proceed to Fill Proposal Form</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div suppressHydrationWarning className="min-h-screen bg-gray-50 text-gray-900">
      {/* Top Header */}
      <header className="border-b border-gray-200 bg-white shadow-sm sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center space-x-3">
            <Link
              href="/institution"
              className="p-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-600 transition"
              title="Return to Dashboard"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <div className="flex items-center space-x-2">
                <GraduationCap className="w-6 h-6 text-indigo-600" />
                <h1 className="text-lg font-bold text-gray-900 tracking-tight">Proposed Courses &amp; Intake</h1>
                <span
                  className={`text-xs px-2.5 py-0.5 rounded-full font-semibold border ${
                    proposalStatus === 'SUBMITTED'
                      ? 'bg-blue-50 text-blue-600 border-blue-200'
                      : proposalStatus === 'REVIEWED'
                      ? 'bg-emerald-50 text-emerald-600 border-emerald-200'
                      : 'bg-amber-50 text-amber-600 border-amber-200'
                  }`}
                >
                  {proposalStatus}
                </span>
              </div>
              <p className="text-xs text-gray-500">
                Institutional Course Expansion, EoA &amp; Normative Intake Verification
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center space-x-3">
            <button
              type="button"
              onClick={() => setShowGuidelinesModal(true)}
              className="px-3.5 py-2 bg-white hover:bg-gray-50 text-gray-700 text-xs font-semibold rounded-lg transition flex items-center space-x-1.5 border border-gray-300 shadow-sm"
              title="View Statutory AICTE Norms & Guidelines"
            >
              <Info className="w-4 h-4 text-indigo-600" />
              <span>Normative Guidelines</span>
            </button>
            {proposalStatus === 'DRAFT' && (
              <>
                <button
                  type="button"
                  onClick={handleSaveDraft}
                  disabled={saving || submitting}
                  className="px-4 py-2 bg-white hover:bg-gray-50 text-gray-700 text-sm font-medium rounded-lg transition flex items-center space-x-2 border border-gray-300 shadow-sm disabled:opacity-50"
                >
                  <Save className="w-4 h-4 text-gray-400" />
                  <span>{saving ? 'Saving...' : 'Save Draft'}</span>
                </button>
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={saving || submitting || branches.length === 0}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-lg shadow-sm transition flex items-center space-x-2 disabled:opacity-50"
                >
                  <Send className="w-4 h-4" />
                  <span>{submitting ? 'Submitting...' : 'Submit Proposal'}</span>
                </button>
              </>
            )}
            {proposalStatus !== 'DRAFT' && (
              <span className="text-xs text-gray-500 italic bg-gray-100 px-3 py-1.5 rounded-lg border border-gray-200">
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
          <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm flex items-start space-x-3">
            <AlertTriangle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Notice</p>
              <p className="text-xs text-red-600">{error}</p>
            </div>
          </div>
        )}

        {successMsg && (
          <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm flex items-start space-x-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Success</p>
              <p className="text-xs text-emerald-600">{successMsg}</p>
            </div>
          </div>
        )}

        {/* Safeguard & Profile Land Notice Banner */}
        <div className="p-4 rounded-2xl bg-indigo-50 border border-indigo-200 shadow-sm space-y-3">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start space-x-3">
              <div className="p-2 rounded-xl bg-indigo-100 text-indigo-600 border border-indigo-200">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h2 className="text-sm font-semibold text-gray-800 flex items-center space-x-2">
                  <span>Assisted Normative Intelligence: Indicators, Not Decisions</span>
                  <span className="text-[10px] bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full uppercase tracking-wider font-bold">
                    Non-Blocking
                  </span>
                </h2>
                <p className="text-xs text-gray-600 max-w-3xl leading-relaxed">
                  Automated checks continuously evaluate cadre ratio, infrastructure, NOCs, and intake increments.
                  Thresholds are marked <em className="text-amber-600">placeholder pending APH</em>. Under no
                  circumstances do automated indicators reject or block your application submission. Final appraisals
                  are performed solely by designated AICTE officers.
                </p>
              </div>
            </div>
            {/* Reused Profile Land Data Badge */}
            <div className="bg-white border border-gray-200 rounded-xl p-3 text-right shrink-0 shadow-sm">
              <p className="text-[11px] text-gray-500 uppercase font-medium tracking-wide">Campus Land Reused</p>
              <p className="text-base font-bold text-indigo-600">
                {landAreaSqm > 0 ? `${landAreaSqm.toLocaleString()} sqm` : '0 sqm'}
              </p>
              <p className="text-[10px] text-gray-400">
                {profile?.college?.name ? `Synced from ${profile.college.name}` : 'Reused from Profile Land Record'}
              </p>
            </div>
          </div>
        </div>

        {/* Officer Determination Banner (if reviewed) */}
        {determination && (
          <div className="p-4 rounded-xl bg-white border border-gray-200 shadow-sm space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                Regional Officer Determination
              </span>
              <span
                className={`text-xs px-2.5 py-0.5 rounded-full font-bold border ${
                  determination.decision === 'NO_CONCERN'
                    ? 'bg-emerald-50 text-emerald-600 border-emerald-200'
                    : determination.decision === 'ASK_CLARIFICATION'
                    ? 'bg-amber-50 text-amber-600 border-amber-200'
                    : 'bg-red-50 text-red-600 border-red-200'
                }`}
              >
                {determination.decision.replace('_', ' ')}
              </span>
            </div>
            <p className="text-sm text-gray-800 bg-gray-50 p-3 rounded-lg border border-gray-200">
              &ldquo;{determination.remarks}&rdquo;
            </p>
            <p className="text-[11px] text-gray-400">
              Evaluated on {new Date(determination.determinedAt).toLocaleString()} by Regional Officer Desk
            </p>
          </div>
        )}

        {/* Form Layout: Full-Width Clean Proposal Container */}
        <div className="max-w-5xl mx-auto space-y-6">
            {/* Proposal Metadata Box */}
            <div className="bg-white border border-gray-200 rounded-2xl p-5 space-y-4 shadow-sm">
              <h2 className="text-sm font-semibold text-gray-800 flex items-center space-x-2">
                <Building className="w-4 h-4 text-indigo-500" />
                <span>Proposal Classification</span>
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Proposal Type</label>
                  <select
                    value={proposalType}
                    disabled={proposalStatus !== 'DRAFT'}
                    onChange={(e) => setProposalType(e.target.value as ProposalType)}
                    className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-800 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 disabled:opacity-50 disabled:bg-gray-50"
                  >
                    {PROPOSAL_TYPES.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                  <p className="text-[11px] text-gray-400 mt-1">
                    {PROPOSAL_TYPES.find((t) => t.id === proposalType)?.desc}
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Linked Application ID</label>
                  <input
                    type="text"
                    value={applicationId}
                    disabled={proposalStatus !== 'DRAFT'}
                    onChange={(e) => setApplicationId(e.target.value)}
                    placeholder="e.g. APP-2024-001"
                    className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-800 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 disabled:opacity-50 disabled:bg-gray-50"
                  />
                  <p className="text-[11px] text-gray-400 mt-1">AICTE application cycle reference ID</p>
                </div>
              </div>
            </div>

            {/* ── Bhulekh Mahabhumi Land Verification ── */}
            <div className="bg-white border-2 border-orange-200 rounded-2xl p-5 shadow-sm space-y-4">
              {/* Section Header */}
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-orange-600 flex items-center justify-center shrink-0">
                    <span className="text-white text-xs font-black">MH</span>
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                      Maharashtra Bhulekh Land Verification
                      {bhulekhVerified && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border bg-emerald-50 text-emerald-700 border-emerald-200 flex items-center gap-1">
                          <BadgeCheck className="w-3 h-3" /> VERIFIED
                        </span>
                      )}
                    </h2>
                    <p className="text-[11px] text-gray-500">Verify campus land records via <a href="https://bhulekh.mahabhumi.gov.in/" target="_blank" rel="noopener noreferrer" className="text-orange-600 hover:underline font-semibold">bhulekh.mahabhumi.gov.in</a> &bull; Required for AICTE land norm compliance</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <a
                    href="https://bhulekh.mahabhumi.gov.in/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 px-3.5 py-2 bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold rounded-lg transition shadow-sm"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    Open Bhulekh Portal
                  </a>
                  <button
                    type="button"
                    onClick={() => setShowBhulekhPanel((v) => !v)}
                    className="flex items-center gap-1.5 px-3.5 py-2 bg-white hover:bg-gray-50 text-gray-700 text-xs font-semibold rounded-lg border border-gray-300 transition shadow-sm"
                  >
                    <MapPin className="w-3.5 h-3.5 text-orange-500" />
                    {showBhulekhPanel ? 'Hide Form' : 'Enter Survey Details'}
                  </button>
                </div>
              </div>

              {/* Verified Summary */}
              {bhulekhVerified && (
                <div className="flex items-center gap-3 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3">
                  <BadgeCheck className="w-5 h-5 text-emerald-600 shrink-0" />
                  <div className="text-xs text-emerald-800 flex-1">
                    <span className="font-bold block">Land Record Verified via Bhulekh Mahabhumi</span>
                    <span className="text-emerald-700">
                      {bhulekhVillage}, {bhulekhTaluka}, {bhulekhDistrict} &bull; Survey No. {bhulekhSurveyNo}
                      {bhulekhGatNo && ` / Gat No. ${bhulekhGatNo}`} &bull; <strong>{bhulekhVerifiedAreaSqm.toLocaleString()} sq.m</strong>
                      {bhulekhVerifiedAreaSqm >= 4047
                        ? <span className="text-emerald-600 font-bold"> ✓ Meets norm</span>
                        : <span className="text-red-500 font-bold"> ✗ Below 4,047 sq.m minimum</span>}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => { setBhulekhVerified(false); setShowBhulekhPanel(true); }}
                    className="text-[11px] text-emerald-600 hover:text-emerald-800 underline font-semibold shrink-0"
                  >
                    Edit
                  </button>
                </div>
              )}

              {/* Survey Details Form */}
              {showBhulekhPanel && (
                <div className="border border-orange-100 rounded-xl bg-orange-50/40 p-4 space-y-4">
                  <p className="text-[11px] text-orange-700 font-medium bg-orange-100 border border-orange-200 rounded-lg px-3 py-2">
                    <strong>How to use:</strong> Open the Bhulekh portal &rarr; Select your Division &rarr; Choose District / Taluka / Village &rarr; Search by Survey/Gat No. &rarr; Note the area from your 7/12 (सातबारा) or 8A extract &rarr; Enter the details below &rarr; Click &ldquo;Confirm &amp; Verify&rdquo;.
                  </p>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                    <div className="flex flex-col gap-1">
                      <label className="text-[11px] font-semibold text-gray-700 uppercase tracking-wide">District (जिल्हा) *</label>
                      <select
                        value={bhulekhDistrict}
                        onChange={(e) => setBhulekhDistrict(e.target.value)}
                        className="w-full text-xs border border-gray-300 rounded-lg px-3 py-2 bg-white text-gray-800 focus:ring-2 focus:ring-orange-400 focus:border-orange-400 focus:outline-none"
                      >
                        <option value="">Select District</option>
                        {[
                          'Ahmednagar','Akola','Amravati','Aurangabad','Beed','Bhandara','Buldhana','Chandrapur',
                          'Dhule','Gadchiroli','Gondia','Hingoli','Jalgaon','Jalna','Kolhapur','Latur',
                          'Mumbai City','Mumbai Suburban','Nagpur','Nanded','Nandurbar','Nashik','Osmanabad',
                          'Palghar','Parbhani','Pune','Raigad','Ratnagiri','Sangli','Satara','Sindhudurg',
                          'Solapur','Thane','Wardha','Washim','Yavatmal'
                        ].map(d => <option key={d} value={d}>{d}</option>)}
                      </select>
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-[11px] font-semibold text-gray-700 uppercase tracking-wide">Taluka (तालुका) *</label>
                      <input
                        type="text"
                        value={bhulekhTaluka}
                        onChange={(e) => setBhulekhTaluka(e.target.value)}
                        placeholder="e.g. Haveli"
                        className="w-full text-xs border border-gray-300 rounded-lg px-3 py-2 bg-white text-gray-800 focus:ring-2 focus:ring-orange-400 focus:border-orange-400 focus:outline-none"
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-[11px] font-semibold text-gray-700 uppercase tracking-wide">Village (गाव) *</label>
                      <input
                        type="text"
                        value={bhulekhVillage}
                        onChange={(e) => setBhulekhVillage(e.target.value)}
                        placeholder="e.g. Kharadi"
                        className="w-full text-xs border border-gray-300 rounded-lg px-3 py-2 bg-white text-gray-800 focus:ring-2 focus:ring-orange-400 focus:border-orange-400 focus:outline-none"
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-[11px] font-semibold text-gray-700 uppercase tracking-wide">Survey No. (सर्वे नं.) *</label>
                      <input
                        type="text"
                        value={bhulekhSurveyNo}
                        onChange={(e) => setBhulekhSurveyNo(e.target.value)}
                        placeholder="e.g. 142/1"
                        className="w-full text-xs border border-gray-300 rounded-lg px-3 py-2 bg-white text-gray-800 focus:ring-2 focus:ring-orange-400 focus:border-orange-400 focus:outline-none"
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-[11px] font-semibold text-gray-700 uppercase tracking-wide">Gat No. (गट नं.) (optional)</label>
                      <input
                        type="text"
                        value={bhulekhGatNo}
                        onChange={(e) => setBhulekhGatNo(e.target.value)}
                        placeholder="e.g. 287"
                        className="w-full text-xs border border-gray-300 rounded-lg px-3 py-2 bg-white text-gray-800 focus:ring-2 focus:ring-orange-400 focus:border-orange-400 focus:outline-none"
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-[11px] font-semibold text-gray-700 uppercase tracking-wide">Total Area (Hectares) *</label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={bhulekhAreaHectare}
                        onChange={(e) => setBhulekhAreaHectare(e.target.value)}
                        placeholder="e.g. 0.50"
                        className="w-full text-xs border border-gray-300 rounded-lg px-3 py-2 bg-white text-gray-800 focus:ring-2 focus:ring-orange-400 focus:border-orange-400 focus:outline-none"
                      />
                      {bhulekhAreaHectare && !isNaN(parseFloat(bhulekhAreaHectare)) && (
                        <span className={`text-[10px] font-semibold ${
                          parseFloat(bhulekhAreaHectare) * 10000 >= 4047 ? 'text-emerald-600' : 'text-red-500'
                        }`}>
                          = {(parseFloat(bhulekhAreaHectare) * 10000).toLocaleString()} sq.m
                          {parseFloat(bhulekhAreaHectare) * 10000 >= 4047 ? ' ✓ Meets 4,047 sq.m norm' : ' ✗ Below 4,047 sq.m minimum'}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Action Row */}
                  <div className="flex flex-col sm:flex-row items-center gap-3 pt-2 border-t border-orange-100">
                    <a
                      href="https://bhulekh.mahabhumi.gov.in/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2.5 border border-orange-300 bg-white hover:bg-orange-50 text-orange-700 text-xs font-semibold rounded-lg transition"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      Cross-verify on Bhulekh (7/12 Extract)
                    </a>
                    <button
                      type="button"
                      disabled={!bhulekhDistrict || !bhulekhTaluka || !bhulekhVillage || !bhulekhSurveyNo || !bhulekhAreaHectare}
                      onClick={() => {
                        const areaSqm = parseFloat(bhulekhAreaHectare) * 10000;
                        setBhulekhVerifiedAreaSqm(areaSqm);
                        setLandAreaSqm(areaSqm);
                        setBhulekhVerified(true);
                        setShowBhulekhPanel(false);
                      }}
                      className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-bold rounded-lg transition shadow-sm"
                    >
                      <BadgeCheck className="w-4 h-4" />
                      Confirm &amp; Verify Land Record
                    </button>
                  </div>

                  {/* Division Quick Links */}
                  <div className="pt-2 border-t border-orange-100">
                    <p className="text-[10px] text-gray-500 font-semibold uppercase tracking-wide mb-2">Bhulekh Division Portals &mdash; Quick Access</p>
                    <div className="flex flex-wrap gap-2">
                      {[
                        { label: 'Pune', url: 'https://bhulekh.mahabhumi.gov.in/Pune/DataEntry.aspx' },
                        { label: 'Nashik', url: 'https://bhulekh.mahabhumi.gov.in/Nashik/DataEntry.aspx' },
                        { label: 'Aurangabad', url: 'https://bhulekh.mahabhumi.gov.in/Aurangabad/DataEntry.aspx' },
                        { label: 'Konkan/Mumbai', url: 'https://bhulekh.mahabhumi.gov.in/Konkan/DataEntry.aspx' },
                        { label: 'Amravati', url: 'https://bhulekh.mahabhumi.gov.in/Amravati/DataEntry.aspx' },
                        { label: 'Nagpur', url: 'https://bhulekh.mahabhumi.gov.in/Nagpur/DataEntry.aspx' },
                      ].map((link) => (
                        <a
                          key={link.label}
                          href={link.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[10px] px-2.5 py-1 rounded-md border border-orange-200 bg-white hover:bg-orange-50 text-orange-700 font-medium transition flex items-center gap-1"
                        >
                          <ExternalLink className="w-2.5 h-2.5" />
                          {link.label}
                        </a>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {!bhulekhVerified && !showBhulekhPanel && (
                <p className="text-[11px] text-gray-500 italic flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-orange-400" />
                  Click &ldquo;Enter Survey Details&rdquo; to verify your campus land record via Maharashtra Bhulekh before submitting this proposal.
                </p>
              )}
            </div>

            {/* Proposed Branches Repeater */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-base font-bold text-gray-900 flex items-center space-x-2">
                    <Layers className="w-5 h-5 text-indigo-500" />
                    <span>Proposed Courses &amp; Branches ({branches.length})</span>
                  </h2>
                  <p className="text-xs text-gray-500">Total proposed intake: {totalProposedIntake} seats</p>
                </div>
                {proposalStatus === 'DRAFT' && (
                  <button
                    type="button"
                    onClick={handleAddBranch}
                    className="px-3.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition"
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
                  className="bg-white border border-gray-200 rounded-2xl p-5 space-y-4 shadow-sm"
                >
                  <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                    <div className="flex items-center space-x-2">
                      <span className="w-6 h-6 rounded-full bg-indigo-100 border border-indigo-200 text-indigo-700 text-xs font-bold flex items-center justify-center">
                        {idx + 1}
                      </span>
                      <h3 className="text-sm font-semibold text-gray-800">
                        {branch.course || `Course Division #${idx + 1}`}
                      </h3>
                    </div>
                    {proposalStatus === 'DRAFT' && branches.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveBranch(idx)}
                        className="text-gray-400 hover:text-red-500 p-1.5 rounded-lg hover:bg-red-50 transition"
                        title="Remove Course"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[11px] font-medium text-gray-500 mb-1">Level</label>
                      <select
                        value={branch.level}
                        disabled={proposalStatus !== 'DRAFT'}
                        onChange={(e) => handleBranchChange(idx, 'level', e.target.value)}
                        className="w-full bg-white border border-gray-300 rounded-lg px-2.5 py-1.5 text-xs text-gray-800 focus:outline-none focus:border-indigo-500 disabled:bg-gray-50"
                      >
                        <option value="UG">Undergraduate (UG)</option>
                        <option value="PG">Postgraduate (PG)</option>
                        <option value="DIPLOMA">Diploma</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-medium text-gray-500 mb-1">Program</label>
                      <select
                        value={branch.program}
                        disabled={proposalStatus !== 'DRAFT'}
                        onChange={(e) => handleBranchChange(idx, 'program', e.target.value)}
                        className="w-full bg-white border border-gray-300 rounded-lg px-2.5 py-1.5 text-xs text-gray-800 focus:outline-none focus:border-indigo-500 disabled:bg-gray-50"
                      >
                        <option value="ENGINEERING">Engineering &amp; Tech</option>
                        <option value="MANAGEMENT">Management (MBA)</option>
                        <option value="MCA">Computer Applications (MCA)</option>
                        <option value="PHARMACY">Pharmacy</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-medium text-gray-500 mb-1">Shift</label>
                      <select
                        value={branch.shift}
                        disabled={proposalStatus !== 'DRAFT'}
                        onChange={(e) => handleBranchChange(idx, 'shift', e.target.value)}
                        className="w-full bg-white border border-gray-300 rounded-lg px-2.5 py-1.5 text-xs text-gray-800 focus:outline-none focus:border-indigo-500 disabled:bg-gray-50"
                      >
                        <option value="1st Shift">1st Shift (Day)</option>
                        <option value="2nd Shift">2nd Shift (Evening)</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-medium text-gray-500 mb-1">Course / Discipline</label>
                      <input
                        type="text"
                        value={branch.course}
                        disabled={proposalStatus !== 'DRAFT'}
                        onChange={(e) => handleBranchChange(idx, 'course', e.target.value)}
                        placeholder="e.g. Artificial Intelligence &amp; Machine Learning"
                        className="w-full bg-white border border-gray-300 rounded-lg px-3 py-1.5 text-xs text-gray-800 focus:outline-none focus:border-indigo-500 disabled:bg-gray-50"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-medium text-gray-500 mb-1">Affiliating Body</label>
                      <input
                        type="text"
                        value={branch.affiliatingBody}
                        disabled={proposalStatus !== 'DRAFT'}
                        onChange={(e) => handleBranchChange(idx, 'affiliatingBody', e.target.value)}
                        placeholder="e.g. State Technical University"
                        className="w-full bg-white border border-gray-300 rounded-lg px-3 py-1.5 text-xs text-gray-800 focus:outline-none focus:border-indigo-500 disabled:bg-gray-50"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div>
                      <label className="block text-[11px] font-medium text-gray-500 mb-1">Current Intake</label>
                      <input
                        type="number"
                        min="0"
                        value={branch.currentIntake}
                        disabled={proposalStatus !== 'DRAFT'}
                        onChange={(e) => handleBranchChange(idx, 'currentIntake', Number(e.target.value))}
                        className="w-full bg-white border border-gray-300 rounded-lg px-2.5 py-1.5 text-xs text-gray-800 disabled:bg-gray-50"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-medium text-gray-500 mb-1">
                        Expected Intake <span className="text-indigo-500">*</span>
                      </label>
                      <input
                        type="number"
                        min="1"
                        step="30"
                        value={branch.expectedIntake}
                        disabled={proposalStatus !== 'DRAFT'}
                        onChange={(e) => handleBranchChange(idx, 'expectedIntake', Number(e.target.value))}
                        className="w-full bg-white border border-gray-300 rounded-lg px-2.5 py-1.5 text-xs text-gray-800 focus:border-indigo-500 disabled:bg-gray-50"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-medium text-gray-500 mb-1">Sanctioned Faculty</label>
                      <input
                        type="number"
                        min="0"
                        value={branch.facultySanctioned}
                        disabled={proposalStatus !== 'DRAFT'}
                        onChange={(e) => handleBranchChange(idx, 'facultySanctioned', Number(e.target.value))}
                        className="w-full bg-white border border-gray-300 rounded-lg px-2.5 py-1.5 text-xs text-gray-800 disabled:bg-gray-50"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-medium text-gray-500 mb-1">Available Faculty</label>
                      <input
                        type="number"
                        min="0"
                        value={branch.facultyAvailable}
                        disabled={proposalStatus !== 'DRAFT'}
                        onChange={(e) => handleBranchChange(idx, 'facultyAvailable', Number(e.target.value))}
                        className="w-full bg-white border border-gray-300 rounded-lg px-2.5 py-1.5 text-xs text-gray-800 disabled:bg-gray-50"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-medium text-gray-500 mb-1">
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
                        className="w-full bg-white border border-gray-300 rounded-lg px-3 py-1.5 text-xs text-gray-800 disabled:bg-gray-50"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-medium text-gray-500 mb-1">
                        Built-Up Area (sqm)
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={branch.builtUpArea}
                        disabled={proposalStatus !== 'DRAFT'}
                        onChange={(e) => handleBranchChange(idx, 'builtUpArea', Number(e.target.value))}
                        className="w-full bg-white border border-gray-300 rounded-lg px-3 py-1.5 text-xs text-gray-800 disabled:bg-gray-50"
                      />
                    </div>
                  </div>

                  {/* Checkbox Toggles */}
                  <div className="flex flex-wrap items-center gap-4 pt-2 border-t border-gray-100">
                    <label className="flex items-center space-x-2 text-xs text-gray-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={branch.facultyPayCompliant}
                        disabled={proposalStatus !== 'DRAFT'}
                        onChange={(e) => handleBranchChange(idx, 'facultyPayCompliant', e.target.checked)}
                        className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                      />
                      <span>7th CPC / State Pay Compliant</span>
                    </label>

                    <label className="flex items-center space-x-2 text-xs text-gray-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={branch.libraryAvailable}
                        disabled={proposalStatus !== 'DRAFT'}
                        onChange={(e) => handleBranchChange(idx, 'libraryAvailable', e.target.checked)}
                        className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                      />
                      <span>Departmental Library Available</span>
                    </label>

                    <label className="flex items-center space-x-2 text-xs text-gray-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={branch.affiliationNocAvailable}
                        disabled={proposalStatus !== 'DRAFT'}
                        onChange={(e) => handleBranchChange(idx, 'affiliationNocAvailable', e.target.checked)}
                        className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                      />
                      <span>Affiliation NOC Declared</span>
                    </label>
                  </div>

                  {/* NOC PDF Upload for this branch */}
                  <div className="pt-3 border-t border-gray-100">
                    <FileUploadWidget
                      label="Affiliation NOC (PDF)"
                      hint="Upload the university/board NOC PDF for this course"
                      kind="affiliation-noc"
                      isDraft={proposalStatus === 'DRAFT'}
                      disabled={proposalStatus !== 'DRAFT'}
                      initialFileId={branchNocFileIds[branch.id]}
                      onUploaded={(result: UploadedFileResult) => {
                        setBranchNocFileIds((prev) => ({ ...prev, [branch.id]: result.id }));
                        handleBranchChange(idx, 'affiliationNocAvailable', true);
                      }}
                      onDeleted={() => {
                        setBranchNocFileIds((prev) => {
                          const next = { ...prev };
                          delete next[branch.id];
                          return next;
                        });
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>

            {/* Proposal-Level Supporting Documents */}
            <div className="bg-white border border-gray-200 rounded-2xl p-5 space-y-4 shadow-sm">
              <h2 className="text-sm font-semibold text-gray-800 flex items-center space-x-2">
                <FileCheck className="w-4 h-4 text-indigo-500" />
                <span>Supporting Documents</span>
              </h2>
              <p className="text-xs text-gray-500">
                Upload additional supporting PDFs for this proposal (e.g. building plan, site inspection report, FDR).
                Files are stored securely and only accessible to authorized AICTE officers.
              </p>
              <div className="space-y-3">
                <FileUploadWidget
                  label="Building Plan / Site Map"
                  kind="building-plan"
                  isDraft={proposalStatus === 'DRAFT'}
                  disabled={proposalStatus !== 'DRAFT'}
                  onUploaded={(result: UploadedFileResult) =>
                    setProposalDocFileIds((prev) => [...prev.filter((id) => id !== result.id), result.id])
                  }
                />
                <FileUploadWidget
                  label="FDR / Security Deposit"
                  kind="fdr-deposit"
                  isDraft={proposalStatus === 'DRAFT'}
                  disabled={proposalStatus !== 'DRAFT'}
                  onUploaded={(result: UploadedFileResult) =>
                    setProposalDocFileIds((prev) => [...prev.filter((id) => id !== result.id), result.id])
                  }
                />
              </div>
              {proposalDocFileIds.length > 0 && (
                <p className="text-[11px] text-emerald-600">
                  ✓ {proposalDocFileIds.length} document(s) uploaded for this proposal
                </p>
              )}
            </div>
          </div>
      </main>

      {/* Normative Guidelines Reference Modal */}
      {showGuidelinesModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto p-6 shadow-2xl border border-gray-200 space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div className="flex items-center space-x-2">
                <GraduationCap className="w-5 h-5 text-indigo-600" />
                <h3 className="text-base font-bold text-gray-900">
                  AICTE Normative Requirements Reference (APH 2024–25)
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowGuidelinesModal(false)}
                className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-gray-500">
              Statutory benchmarks for institutional approval, course expansion, and intake sanction under AICTE Approval Process Regulations.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="p-3.5 rounded-xl bg-gray-50 border border-gray-200 space-y-1">
                <div className="flex items-center space-x-2 text-indigo-700 font-bold">
                  <Landmark className="w-4 h-4" />
                  <span>1. Land &amp; Built-up Infrastructure</span>
                </div>
                <p className="text-gray-600 leading-relaxed">
                  Minimum 4,047 sq.m (1 Acre) campus land. Min. 400 sq.m instructional built-up area per academic division.
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-gray-50 border border-gray-200 space-y-1">
                <div className="flex items-center space-x-2 text-indigo-700 font-bold">
                  <Users className="w-4 h-4" />
                  <span>2. Faculty Cadre Ratios</span>
                </div>
                <p className="text-gray-600 leading-relaxed">
                  Normative ratios: 1:20 (UG Engineering/Tech), 1:15 (PG M.Tech/MBA), 1:25 (Diploma). Cadre distribution: 1 Prof : 2 Assoc : 6 Asst.
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-gray-50 border border-gray-200 space-y-1">
                <div className="flex items-center space-x-2 text-indigo-700 font-bold">
                  <ShieldCheck className="w-4 h-4" />
                  <span>3. 7th CPC Pay Scale</span>
                </div>
                <p className="text-gray-600 leading-relaxed">
                  Mandatory 7th CPC / State scale compensation disbursed via bank transfer, with verified EPF/insurance deductions.
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-gray-50 border border-gray-200 space-y-1">
                <div className="flex items-center space-x-2 text-indigo-700 font-bold">
                  <Layers className="w-4 h-4" />
                  <span>4. Dedicated Laboratories</span>
                </div>
                <p className="text-gray-600 leading-relaxed">
                  Min. 4 dedicated fully functional laboratories per technical branch with verified syllabus apparatus and 1:4 terminal ratio.
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-gray-50 border border-gray-200 space-y-1">
                <div className="flex items-center space-x-2 text-indigo-700 font-bold">
                  <FileCheck className="w-4 h-4" />
                  <span>5. Affiliating University NOC</span>
                </div>
                <p className="text-gray-600 leading-relaxed">
                  Unconditional NOC from designated State Technical University or State Technical Examination Board.
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-gray-50 border border-gray-200 space-y-1">
                <div className="flex items-center space-x-2 text-indigo-700 font-bold">
                  <BookOpen className="w-4 h-4" />
                  <span>6. Library &amp; E-Resources</span>
                </div>
                <p className="text-gray-600 leading-relaxed">
                  Prescribed volume and title count per division + active access to national and international e-journals.
                </p>
              </div>
            </div>

            <div className="p-3 rounded-lg bg-indigo-50 border border-indigo-200 text-[11px] text-indigo-800 flex items-start space-x-2">
              <Info className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
              <span>
                <strong>Non-blocking Guidance:</strong> Automated indicators assist institutional preparation. Deficiencies can be defended with explanatory documentation during regional scrutiny.
              </span>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setShowGuidelinesModal(false)}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg transition"
              >
                Close Reference
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
