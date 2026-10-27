import React from 'react';
import {
  Building2,
  FileCheck2,
  FileSearch,
  Scale,
  ShieldCheck,
  CheckCircle2,
  FileText,
  MapPin,
  HelpCircle,
  AlertTriangle,
} from 'lucide-react';

export default function HomePage() {
  return (
    <div className="space-y-12 pb-16 bg-slate-50 min-h-screen">
      {/* Informational Header Section */}
      <section className="bg-gradient-to-b from-gov-blue-900 to-gov-blue-800 text-white py-14 px-4 sm:px-6 lg:px-8 border-b-4 border-gov-saffron">
        <div className="max-w-5xl mx-auto text-center space-y-5">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 border border-white/20 text-xs font-semibold text-gov-gold">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            Statutory Approval Portal · Academic Years 2024–2027
          </div>

          <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-white max-w-4xl mx-auto leading-tight">
            All India Council for Technical Education
          </h1>

          <p className="text-sm sm:text-base text-blue-100 max-w-3xl mx-auto leading-relaxed">
            Statutory regulatory platform for grant of approval, extension of approval (EoA), variation in intake, and introduction of new courses in technical and management institutions across the Republic of India under the AICTE Act, 1987.
          </p>

          <div className="pt-2 flex flex-wrap justify-center items-center gap-6 text-xs text-blue-200">
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" /> AICTE Act No. 52 of 1987
            </span>
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" /> National Technical Education Standards
            </span>
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" /> Zero Tolerance for Document Tampering
            </span>
          </div>
        </div>
      </section>

      {/* Statutory Workflow Overview (Non-Interactive) */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white rounded-2xl border border-slate-200 p-6 md:p-8 shadow-sm">
          <div className="text-center mb-8">
            <span className="text-xs font-bold uppercase tracking-wider text-gov-saffron">
              Statutory Process
            </span>
            <h2 className="text-xl sm:text-2xl font-bold text-slate-900 mt-1">
              Approval Lifecycle Architecture
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 max-w-2xl mx-auto mt-2">
              Every application is governed by deterministic regulatory milestones from initial institutional profile validation through final cryptographic ledger recording.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6">
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-center">
              <div className="w-12 h-12 rounded-xl bg-blue-100 text-gov-blue-800 flex items-center justify-center font-bold mx-auto mb-3 shadow-sm">
                <FileCheck2 className="w-6 h-6" />
              </div>
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Stage 1</span>
              <h3 className="font-bold text-sm text-slate-900 mt-1">Profile & Application</h3>
              <p className="text-xs text-slate-600 mt-1.5 leading-relaxed">
                Mandatory institutional profile verification, trust registration, bank validation, and state-specific land documents.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-center">
              <div className="w-12 h-12 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold mx-auto mb-3 shadow-sm">
                <FileSearch className="w-6 h-6" />
              </div>
              <span className="text-[11px] font-bold text-indigo-600 uppercase tracking-wider">Stage 2</span>
              <h3 className="font-bold text-sm text-slate-900 mt-1">Document Scrutiny</h3>
              <p className="text-xs text-slate-600 mt-1.5 leading-relaxed">
                Automated multi-signal validation, OCR extraction, validity verification, and regional officer regulatory scrutiny.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-center">
              <div className="w-12 h-12 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center font-bold mx-auto mb-3 shadow-sm">
                <Building2 className="w-6 h-6" />
              </div>
              <span className="text-[11px] font-bold text-amber-600 uppercase tracking-wider">Stage 3</span>
              <h3 className="font-bold text-sm text-slate-900 mt-1">Expert Committee (EVC)</h3>
              <p className="text-xs text-slate-600 mt-1.5 leading-relaxed">
                Empaneled experts conduct physical and digital verification of campus infrastructure, labs, and safety parameters.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-center">
              <div className="w-12 h-12 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center font-bold mx-auto mb-3 shadow-sm">
                <Scale className="w-6 h-6" />
              </div>
              <span className="text-[11px] font-bold text-purple-600 uppercase tracking-wider">Stage 4</span>
              <h3 className="font-bold text-sm text-slate-900 mt-1">Council Determination</h3>
              <p className="text-xs text-slate-600 mt-1.5 leading-relaxed">
                Executive Committee review, formal approval order, deficiency remediation, or Standing Appellate Committee hearing.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-center">
              <div className="w-12 h-12 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold mx-auto mb-3 shadow-sm">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <span className="text-[11px] font-bold text-emerald-600 uppercase tracking-wider">Stage 5</span>
              <h3 className="font-bold text-sm text-slate-900 mt-1">Cryptographic Ledger</h3>
              <p className="text-xs text-slate-600 mt-1.5 leading-relaxed">
                Immutable SHA-256 chained audit record published to ensure public verifiability and complete institutional transparency.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Norms & Guidelines Information */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-4">
            <div className="flex items-center gap-2.5 text-gov-blue-900 font-bold text-base">
              <FileText className="w-5 h-5 text-gov-saffron" />
              Mandatory Institutional Prerequisites
            </div>
            <ul className="text-xs sm:text-sm text-slate-600 space-y-2.5 leading-relaxed">
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <span><strong>Institutional Profile:</strong> Sponsoring Trust/Society registration, bank credentials, and verified contact officer must be registered and verified prior to application filing.</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <span><strong>State Land Documentation:</strong> Title deeds, mutation certificates, non-agricultural conversion orders, or registered lease deed meeting state jurisdiction requirements.</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <span><strong>Financial Security:</strong> Joint Fixed Deposit Receipt (FDR) created in favor of Member Secretary, AICTE and Chairman of the Sponsoring Body.</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <span><strong>Safety Approvals:</strong> Approved building plans by local planning authority, structural stability certificate, and active Fire Department NOC.</span>
              </li>
            </ul>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-4">
            <div className="flex items-center gap-2.5 text-gov-blue-900 font-bold text-base">
              <MapPin className="w-5 h-5 text-gov-saffron" />
              AICTE Regional Jurisdictions
            </div>
            <div className="text-xs sm:text-sm text-slate-600 space-y-2 leading-relaxed">
              <p>Institutions are mapped deterministically to their respective AICTE Regional Offices based on geographic location:</p>
              <div className="grid grid-cols-2 gap-2 text-xs pt-2">
                <div className="bg-slate-50 p-2.5 rounded border border-slate-100">
                  <span className="font-semibold text-slate-800">Northern:</span> UP, UK
                </div>
                <div className="bg-slate-50 p-2.5 rounded border border-slate-100">
                  <span className="font-semibold text-slate-800">North-Western:</span> DL, HR, PB, RJ, HP, JK
                </div>
                <div className="bg-slate-50 p-2.5 rounded border border-slate-100">
                  <span className="font-semibold text-slate-800">Central:</span> MP, CG, GJ
                </div>
                <div className="bg-slate-50 p-2.5 rounded border border-slate-100">
                  <span className="font-semibold text-slate-800">Western:</span> MH, GA
                </div>
                <div className="bg-slate-50 p-2.5 rounded border border-slate-100">
                  <span className="font-semibold text-slate-800">Eastern:</span> WB, BR, JH, OD, NE States
                </div>
                <div className="bg-slate-50 p-2.5 rounded border border-slate-100">
                  <span className="font-semibold text-slate-800">Southern:</span> TN, KL, UTs
                </div>
                <div className="bg-slate-50 p-2.5 rounded border border-slate-100">
                  <span className="font-semibold text-slate-800">South-Western:</span> KA, Lakshadweep
                </div>
                <div className="bg-slate-50 p-2.5 rounded border border-slate-100">
                  <span className="font-semibold text-slate-800">South-Central:</span> AP, TS
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Advisory & Notice */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 flex items-start gap-3.5">
          <AlertTriangle className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
          <div className="space-y-1 text-xs sm:text-sm text-amber-900">
            <div className="font-bold">Statutory Advisory on Portal Access</div>
            <p className="leading-relaxed">
              Technical institutions intending to submit applications for establishment of new technical institutions or extension of approval must register through their official institutional email domain. All credentials and multi-factor verification tokens are bound to the registered institution profile. Regional scrutiny officers and committee experts access designated regulatory queues via official credentials.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
