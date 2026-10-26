'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Building2,
  ClipboardCheck,
  Users,
  FileCheck2,
  Cpu,
  ShieldCheck,
  ArrowRight,
  Sparkles,
  CheckCircle,
  FileSearch,
  Scale,
  Award,
} from 'lucide-react';
import {
  getApplications,
  getStoredUser,
  isAuthenticated,
  setStoredRole,
} from '../lib/api';

export default function HomePage() {
  const [appCount, setAppCount] = useState(0);

  useEffect(() => {
    if (!isAuthenticated()) return;
    getApplications()
      .then((res) => {
        if (res.data) setAppCount(res.data.length);
      })
      .catch(() => {
        setAppCount(0);
      });
  }, []);

  const handleRoleCardClick = (role: 'institution' | 'officer' | 'committee') => {
    if (!getStoredUser()) setStoredRole(role);
  };

  return (
    <div className="space-y-12 pb-12">

      {/* Hero Section */}
      <section className="bg-gradient-to-b from-gov-blue-900 to-gov-blue-800 text-white py-16 px-4 sm:px-6 lg:px-8 border-b-4 border-gov-saffron">
        <div className="max-w-5xl mx-auto text-center space-y-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 border border-white/20 text-xs font-semibold text-gov-gold">
            <Sparkles className="w-3.5 h-3.5" />
            AICTE NextGen Workflow Engine
          </div>

          <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-white max-w-4xl mx-auto leading-tight">
            Intelligent Automation for Technical Institution Approvals
          </h1>

          {/* One-paragraph project summary */}
          <p className="text-base sm:text-lg text-blue-100 max-w-3xl mx-auto leading-relaxed">
            The <strong>aicte-approval-system</strong> transforms the regulatory approval lifecycle for engineering and technical institutions across India by replacing weeks of manual verification with instant AI document scrutiny, deterministic state-machine workflow enforcement, SLA tracking, and an append-only SHA-256 cryptographic audit ledger that guarantees zero tampering.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-4 pt-4">
            <Link
              href="/institution"
              onClick={() => handleRoleCardClick('institution')}
              className="px-6 py-3 rounded-lg bg-gov-saffron hover:bg-orange-600 text-white font-bold text-sm shadow-lg transition-all flex items-center gap-2"
            >
              <Building2 className="w-4 h-4" />
              Apply as Institution
            </Link>
            <Link
              href="/officer"
              onClick={() => handleRoleCardClick('officer')}
              className="px-6 py-3 rounded-lg bg-white/10 hover:bg-white/20 text-white font-bold text-sm border border-white/20 transition-all flex items-center gap-2"
            >
              <ClipboardCheck className="w-4 h-4" />
              Officer Scrutiny Queue
            </Link>
          </div>
        </div>
      </section>

      {/* "How It Works" Workflow Strip */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white rounded-2xl border border-slate-200 p-6 md:p-8 shadow-sm">
          <div className="text-center mb-8">
            <span className="text-xs font-bold uppercase tracking-wider text-gov-saffron">
              Deterministic Pipeline
            </span>
            <h2 className="text-xl sm:text-2xl font-bold text-slate-900 mt-1">
              How AICTE Approval Works
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6 relative">
            {/* Step 1 */}
            <div className="flex flex-col items-center text-center p-4 rounded-xl bg-slate-50 border border-slate-200">
              <div className="w-12 h-12 rounded-xl bg-blue-100 text-gov-blue-800 flex items-center justify-center font-bold mb-3 shadow-sm">
                <FileCheck2 className="w-6 h-6" />
              </div>
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Step 1</span>
              <h3 className="font-bold text-sm text-slate-900 mt-1">Submit</h3>
              <p className="text-xs text-slate-600 mt-1">
                College uploads lease deeds, building plans & fire NOCs online.
              </p>
            </div>

            {/* Step 2 */}
            <div className="flex flex-col items-center text-center p-4 rounded-xl bg-slate-50 border border-slate-200">
              <div className="w-12 h-12 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold mb-3 shadow-sm">
                <FileSearch className="w-6 h-6" />
              </div>
              <span className="text-xs font-bold text-indigo-600 uppercase tracking-wider">Step 2</span>
              <h3 className="font-bold text-sm text-slate-900 mt-1">AI Scrutiny</h3>
              <p className="text-xs text-slate-600 mt-1">
                Automated rule validation evaluates land area, lease buffer & fire expiry.
              </p>
            </div>

            {/* Step 3 */}
            <div className="flex flex-col items-center text-center p-4 rounded-xl bg-slate-50 border border-slate-200">
              <div className="w-12 h-12 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center font-bold mb-3 shadow-sm">
                <Users className="w-6 h-6" />
              </div>
              <span className="text-xs font-bold text-amber-600 uppercase tracking-wider">Step 3</span>
              <h3 className="font-bold text-sm text-slate-900 mt-1">Inspection</h3>
              <p className="text-xs text-slate-600 mt-1">
                Expert Visit Committee (EVC) performs geo-tagged physical verification.
              </p>
            </div>

            {/* Step 4 */}
            <div className="flex flex-col items-center text-center p-4 rounded-xl bg-slate-50 border border-slate-200">
              <div className="w-12 h-12 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center font-bold mb-3 shadow-sm">
                <Scale className="w-6 h-6" />
              </div>
              <span className="text-xs font-bold text-purple-600 uppercase tracking-wider">Step 4</span>
              <h3 className="font-bold text-sm text-slate-900 mt-1">Decision</h3>
              <p className="text-xs text-slate-600 mt-1">
                Executive Committee review, formal approval order, or hearing appeal.
              </p>
            </div>

            {/* Step 5 */}
            <div className="flex flex-col items-center text-center p-4 rounded-xl bg-slate-50 border border-slate-200">
              <div className="w-12 h-12 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold mb-3 shadow-sm">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <span className="text-xs font-bold text-emerald-600 uppercase tracking-wider">Step 5</span>
              <h3 className="font-bold text-sm text-slate-900 mt-1">Ledger Proof</h3>
              <p className="text-xs text-slate-600 mt-1">
                SHA-256 cryptographic chain published for public transparency & tamper check.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Role Cards Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-8">
          <span className="text-xs font-bold uppercase tracking-wider text-gov-blue-700">
            Role-Based Access
          </span>
          <h2 className="text-2xl font-bold text-slate-900 mt-1">Select Your Portal Role</h2>
          <p className="text-sm text-slate-600">
            Switch your role to interact with specific stages of the approval workflow.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Card 1: Institution */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-all p-6 flex flex-col justify-between group">
            <div className="space-y-4">
              <div className="w-12 h-12 rounded-xl bg-blue-50 text-gov-blue-800 flex items-center justify-center">
                <Building2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900 group-hover:text-gov-blue-800 transition-colors">
                  Institution Portal
                </h3>
                <p className="text-xs text-slate-600 mt-1">
                  For college trusts, polytechnics, and universities. Submit new applications, track live status, review AI deficiency reports, and view historical approvals.
                </p>
              </div>
              <ul className="text-xs text-slate-600 space-y-1.5 pt-2 border-t border-slate-100">
                <li className="flex items-center gap-1.5">
                  <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                  Self-service application submission
                </li>
                <li className="flex items-center gap-1.5">
                  <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                  Clause-by-clause deficiency resolution
                </li>
              </ul>
            </div>
            <Link
              href="/institution"
              onClick={() => handleRoleCardClick('institution')}
              className="mt-6 inline-flex items-center justify-between w-full px-4 py-2.5 rounded-lg bg-gov-blue-900 text-white font-semibold text-xs hover:bg-gov-blue-800 transition-colors"
            >
              <span>Access Institution Portal</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          {/* Card 2: Officer */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-all p-6 flex flex-col justify-between group">
            <div className="space-y-4">
              <div className="w-12 h-12 rounded-xl bg-amber-50 text-gov-gold flex items-center justify-center">
                <ClipboardCheck className="w-6 h-6 text-amber-600" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900 group-hover:text-gov-gold transition-colors">
                  Scrutiny Officer Queue
                </h3>
                <p className="text-xs text-slate-600 mt-1">
                  For AICTE regional scrutiny officers. Execute automated rule checks, inspect SLA countdowns, and advance valid state machine transitions.
                </p>
              </div>
              <ul className="text-xs text-slate-600 space-y-1.5 pt-2 border-t border-slate-100">
                <li className="flex items-center gap-1.5">
                  <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                  Single-click automated rule scrutiny
                </li>
                <li className="flex items-center gap-1.5">
                  <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                  SLA warning & state machine enforcement
                </li>
              </ul>
            </div>
            <Link
              href="/officer"
              onClick={() => handleRoleCardClick('officer')}
              className="mt-6 inline-flex items-center justify-between w-full px-4 py-2.5 rounded-lg bg-gov-blue-900 text-white font-semibold text-xs hover:bg-gov-blue-800 transition-colors"
            >
              <span>Open Officer Queue</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          {/* Card 3: Committee */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-all p-6 flex flex-col justify-between group">
            <div className="space-y-4">
              <div className="w-12 h-12 rounded-xl bg-purple-50 text-purple-700 flex items-center justify-center">
                <Users className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900 group-hover:text-purple-700 transition-colors">
                  Expert Committee (EVC)
                </h3>
                <p className="text-xs text-slate-600 mt-1">
                  For peer review experts and inspection team members. View assigned physical site inspections, campus infrastructure checklist, and safety verifications.
                </p>
              </div>
              <ul className="text-xs text-slate-600 space-y-1.5 pt-2 border-t border-slate-100">
                <li className="flex items-center gap-1.5">
                  <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                  Assigned campus inspections roster
                </li>
                <li className="flex items-center gap-1.5">
                  <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                  Read-only committee norms checklist
                </li>
              </ul>
            </div>
            <Link
              href="/committee"
              onClick={() => handleRoleCardClick('committee')}
              className="mt-6 inline-flex items-center justify-between w-full px-4 py-2.5 rounded-lg bg-gov-blue-900 text-white font-semibold text-xs hover:bg-gov-blue-800 transition-colors"
            >
              <span>View Committee Tasks</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* Public Cryptographic Verification Callout */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-slate-900 text-white rounded-2xl p-6 sm:p-8 flex flex-col md:flex-row items-center justify-between gap-6 border border-slate-800">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded text-[11px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              <ShieldCheck className="w-3.5 h-3.5" />
              Tamper-Proof Audit
            </div>
            <h3 className="text-xl font-bold">Public Blockchain/Ledger Verification</h3>
            <p className="text-xs sm:text-sm text-slate-300 max-w-2xl">
              Anyone can verify the authenticity of an AICTE approval decision. Every status transition, officer action, and deficiency check is immutably chained using SHA-256 hashes.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/verify/APP-2024-001"
              className="px-4 py-2.5 rounded-lg bg-white/10 hover:bg-white/20 border border-white/20 text-xs font-semibold text-white transition-all flex items-center gap-2"
            >
              Verify APP-2024-001
            </Link>
            <Link
              href="/verify/APP-2024-004"
              className="px-4 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-xs font-semibold text-white transition-all flex items-center gap-2"
            >
              Verify APP-2024-004 (Approved)
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
