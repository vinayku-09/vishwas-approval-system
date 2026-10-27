'use client';

import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  Key,
  ShieldAlert,
  AlertTriangle,
  CheckCircle2,
  HelpCircle,
  Copy,
  Check,
  ArrowRight,
  RefreshCw,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  FileText,
  BadgeAlert,
  Sliders,
} from 'lucide-react';
import { AiScrutinyAnalysis } from '../lib/types';
import {
  getStoredGeminiApiKey,
  setStoredGeminiApiKey,
  removeStoredGeminiApiKey,
  testGeminiApiKey,
  runAiScrutiny,
} from '../lib/api';

interface AiOfficerScrutinyAssistantProps {
  type: 'APPLICATION' | 'COURSE_PROPOSAL';
  data: any;
  onApplyRemarks?: (remarks: string, recommendedDecision?: 'NO_CONCERN' | 'ASK_CLARIFICATION' | 'REFER') => void;
  className?: string;
}

export default function AiOfficerScrutinyAssistant({
  type,
  data,
  onApplyRemarks,
  className = '',
}: AiOfficerScrutinyAssistantProps) {
  const [apiKey, setApiKey] = useState<string>('');
  const [hasKey, setHasKey] = useState<boolean>(false);
  const [showKeyModal, setShowKeyModal] = useState<boolean>(false);
  const [keyInput, setKeyInput] = useState<string>('');
  const [testingKey, setTestingKey] = useState<boolean>(false);
  const [testResult, setTestResult] = useState<{ valid?: boolean; message?: string; error?: string } | null>(null);

  const [analyzing, setAnalyzing] = useState<boolean>(false);
  const [analysis, setAnalysis] = useState<AiScrutinyAnalysis | null>(null);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<boolean>(true);
  const [copiedRemarks, setCopiedRemarks] = useState<boolean>(false);
  const [appliedNotice, setAppliedNotice] = useState<boolean>(false);

  useEffect(() => {
    const stored = getStoredGeminiApiKey();
    if (stored) {
      setApiKey(stored);
      setKeyInput(stored);
      setHasKey(true);
    }
  }, []);

  const handleSaveKey = () => {
    const clean = keyInput.trim();
    if (clean) {
      setStoredGeminiApiKey(clean);
      setApiKey(clean);
      setHasKey(true);
      setShowKeyModal(false);
      setTestResult(null);
    } else {
      removeStoredGeminiApiKey();
      setApiKey('');
      setHasKey(false);
      setShowKeyModal(false);
      setTestResult(null);
    }
  };

  const handleTestKey = async () => {
    const keyToTest = keyInput.trim() || apiKey;
    if (!keyToTest) {
      setTestResult({ valid: false, error: 'Please enter a Gemini API key first.' });
      return;
    }
    setTestingKey(true);
    setTestResult(null);
    const res = await testGeminiApiKey(keyToTest);
    setTestingKey(false);
    setTestResult(res);
  };

  const handleRunAnalysis = async () => {
    setAnalyzing(true);
    setAnalysisError(null);
    setAppliedNotice(false);

    const res = await runAiScrutiny({
      type,
      data,
      apiKey: apiKey || undefined,
    });

    setAnalyzing(false);

    if (res.data) {
      setAnalysis(res.data);
      setExpanded(true);
    } else {
      setAnalysisError(res.error || 'Failed to complete AI scrutiny analysis.');
    }
  };

  const handleCopyRemarks = () => {
    if (!analysis?.draftOfficerRemarks) return;
    navigator.clipboard.writeText(analysis.draftOfficerRemarks);
    setCopiedRemarks(true);
    setTimeout(() => setCopiedRemarks(false), 2000);
  };

  const handleApplyToForm = () => {
    if (!analysis?.draftOfficerRemarks || !onApplyRemarks) return;
    onApplyRemarks(analysis.draftOfficerRemarks, analysis.recommendedDecision);
    setAppliedNotice(true);
    setTimeout(() => setAppliedNotice(false), 3500);
  };

  return (
    <div
      className={`rounded-2xl border border-indigo-200 bg-gradient-to-br from-indigo-950 via-slate-900 to-indigo-900 text-white shadow-xl overflow-hidden ${className}`}
    >
      {/* Top Banner Bar */}
      <div className="p-4 sm:p-5 flex flex-wrap items-center justify-between gap-3 border-b border-indigo-800/60 bg-black/20">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-amber-400 to-amber-200 text-slate-950 flex items-center justify-center font-bold shadow-md shadow-amber-400/20">
            <Sparkles className="w-5 h-5 text-indigo-950" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-extrabold tracking-wide text-white">
                AI Scrutiny & Fault Analysis Assistant
              </h3>
              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-400/20 text-amber-300 border border-amber-400/30">
                Gemini AI Powered
              </span>
            </div>
            <p className="text-[11px] text-indigo-200 mt-0.5">
              Audits compliance against statutory AICTE Approval Process Handbook (APH) from the Officer's perspective.
            </p>
          </div>
        </div>

        {/* Action Controls in Header */}
        <div className="flex items-center gap-2">
          {/* Key Status Pill */}
          <button
            type="button"
            onClick={() => {
              setShowKeyModal(true);
              setKeyInput(apiKey);
              setTestResult(null);
            }}
            className={`text-xs font-semibold px-3 py-1.5 rounded-lg border flex items-center gap-1.5 transition-all ${
              hasKey
                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-400/40 hover:bg-emerald-500/30'
                : 'bg-amber-500/20 text-amber-300 border-amber-400/40 hover:bg-amber-500/30 animate-pulse'
            }`}
          >
            <Key className="w-3.5 h-3.5" />
            <span>{hasKey ? 'Gemini Key Configured ✓' : 'Set Gemini API Key ⚙️'}</span>
          </button>

          {/* Trigger Analysis Button */}
          <button
            type="button"
            onClick={handleRunAnalysis}
            disabled={analyzing}
            className="text-xs font-bold px-4 py-1.5 rounded-lg bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 shadow-md shadow-amber-400/20 flex items-center gap-1.5 transition-all disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${analyzing ? 'animate-spin' : ''}`} />
            <span>{analyzing ? 'Analyzing Norms...' : 'Run Scrutiny Analysis'}</span>
          </button>

          {analysis && (
            <button
              type="button"
              onClick={() => setExpanded(!expanded)}
              className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors"
            >
              {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
          )}
        </div>
      </div>

      {/* Inline Key Configuration Modal / Drawer */}
      {showKeyModal && (
        <div className="p-4 sm:p-5 bg-indigo-900/90 border-b border-indigo-700/60 text-xs space-y-3 animate-in fade-in duration-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 font-bold text-amber-300">
              <Key className="w-4 h-4" />
              <span>Configure Google Gemini API Key</span>
            </div>
            <a
              href="https://aistudio.google.com/app/apikey"
              target="_blank"
              rel="noreferrer"
              className="text-[11px] text-blue-200 hover:text-white underline inline-flex items-center gap-1"
            >
              Get Free Key from Google AI Studio <ExternalLink className="w-3 h-3" />
            </a>
          </div>

          <p className="text-[11px] text-indigo-100 leading-relaxed">
            Your API key is used exclusively in your browser session to evaluate AICTE application and course proposal
            compliance against statutory cadre, land, and infrastructure rules.
          </p>

          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="password"
              value={keyInput}
              onChange={(e) => setKeyInput(e.target.value)}
              placeholder="Paste AIzaSy... Gemini API key here"
              className="flex-1 rounded-lg bg-black/40 border border-indigo-400/40 px-3 py-2 text-xs text-white placeholder-indigo-300/50 focus:outline-none focus:ring-2 focus:ring-amber-400"
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleTestKey}
                disabled={testingKey || !keyInput.trim()}
                className="px-3 py-2 rounded-lg bg-white/10 hover:bg-white/20 border border-white/20 font-semibold text-white transition disabled:opacity-50"
              >
                {testingKey ? 'Testing...' : 'Test Key'}
              </button>
              <button
                type="button"
                onClick={handleSaveKey}
                className="px-4 py-2 rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold transition shadow-sm"
              >
                Save Key
              </button>
              <button
                type="button"
                onClick={() => setShowKeyModal(false)}
                className="px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 font-semibold text-indigo-200 transition"
              >
                Cancel
              </button>
            </div>
          </div>

          {testResult && (
            <div
              className={`p-2.5 rounded-lg border text-[11px] font-semibold flex items-center gap-2 ${
                testResult.valid
                  ? 'bg-emerald-500/20 border-emerald-400/50 text-emerald-200'
                  : 'bg-red-500/20 border-red-400/50 text-red-200'
              }`}
            >
              {testResult.valid ? <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" /> : <ShieldAlert className="w-4 h-4 shrink-0 text-red-400" />}
              <span>{testResult.message || testResult.error}</span>
            </div>
          )}
        </div>
      )}

      {/* Analysis Error Message */}
      {analysisError && (
        <div className="p-4 bg-red-950/70 border-b border-red-800 text-red-200 text-xs flex items-start gap-2.5">
          <ShieldAlert className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-bold">Scrutiny Assistant Notice</p>
            <p className="text-[11px] text-red-300 mt-0.5">{analysisError}</p>
            {!hasKey && (
              <button
                type="button"
                onClick={() => setShowKeyModal(true)}
                className="mt-2 inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1 bg-amber-400 text-slate-950 rounded-md hover:bg-amber-300"
              >
                <Key className="w-3.5 h-3.5" /> Configure Gemini API Key Now
              </button>
            )}
          </div>
        </div>
      )}

      {/* Idle / Callout State */}
      {!analysis && !analyzing && !analysisError && (
        <div className="p-5 sm:p-6 text-center text-xs text-indigo-200 space-y-2">
          <p className="font-semibold text-white">
            Ready to evaluate institutional proposals against AICTE Approval Handbook guidelines.
          </p>
          <p className="text-[11px] text-indigo-300 max-w-xl mx-auto">
            Click <strong>"Run Scrutiny Analysis"</strong> to automatically evaluate Faculty-Student Ratios, Built-up area,
            Affiliation NOCs, and Bhulekh 7/12 land records. The AI will formulate official faults, required changes,
            and draft official officer determination remarks.
          </p>
        </div>
      )}

      {/* Loading Animation */}
      {analyzing && (
        <div className="p-8 text-center space-y-3">
          <div className="relative w-12 h-12 mx-auto">
            <div className="w-12 h-12 rounded-full border-4 border-amber-400/20 border-t-amber-400 animate-spin" />
            <Sparkles className="w-5 h-5 text-amber-300 absolute inset-0 m-auto animate-pulse" />
          </div>
          <p className="text-xs font-bold text-amber-300">
            Gemini AI Auditing Statutory Compliance & Cadre Norms...
          </p>
          <p className="text-[11px] text-indigo-300">
            Evaluating Faculty Ratios &bull; Built-Up Area &bull; Bhulekh 7/12 Title &bull; Affiliation NOC
          </p>
        </div>
      )}

      {/* Scrutiny Results Panel */}
      {analysis && expanded && (
        <div className="p-5 sm:p-6 space-y-5 text-xs bg-slate-900/60">
          {/* Executive Summary & Risk Rating */}
          <div className="p-4 rounded-xl bg-white/5 border border-white/10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-300">
                Executive Scrutiny Finding
              </span>
              <p className="text-xs font-semibold text-white leading-relaxed">{analysis.summary}</p>
            </div>
            <div className="shrink-0 flex items-center gap-2">
              <span className="text-[11px] text-slate-300 font-medium">Risk Assessment:</span>
              <span
                className={`px-3 py-1 rounded-full text-xs font-black uppercase border tracking-wider ${
                  analysis.riskLevel === 'HIGH'
                    ? 'bg-red-500/20 text-red-300 border-red-500/40'
                    : analysis.riskLevel === 'MEDIUM'
                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                    : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                }`}
              >
                {analysis.riskLevel} RISK
              </span>
            </div>
          </div>

          {/* Faults & What is Wrong Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Faults Identified */}
            <div className="p-4 rounded-xl bg-red-950/30 border border-red-500/30 space-y-2.5">
              <div className="flex items-center gap-2 text-red-300 font-bold text-xs uppercase tracking-wider">
                <BadgeAlert className="w-4 h-4 text-red-400" />
                <span>Statutory Faults & Deficiencies ({analysis.faults?.length || 0})</span>
              </div>
              <ul className="space-y-2">
                {analysis.faults?.map((fault: string, idx: number) => (
                  <li key={idx} className="flex items-start gap-2 text-[11px] text-red-200">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-400 mt-1.5 shrink-0" />
                    <span>{fault}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* What is Wrong in Officer Perspective */}
            <div className="p-4 rounded-xl bg-amber-950/30 border border-amber-500/30 space-y-2.5">
              <div className="flex items-center gap-2 text-amber-300 font-bold text-xs uppercase tracking-wider">
                <AlertTriangle className="w-4 h-4 text-amber-400" />
                <span>Officer Appraisal: What is Wrong</span>
              </div>
              <ul className="space-y-2">
                {analysis.whatIsWrong?.map((item: string, idx: number) => (
                  <li key={idx} className="flex items-start gap-2 text-[11px] text-amber-200">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400 mt-1.5 shrink-0" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Suggested Changes / Institutional Remedies */}
          <div className="p-4 rounded-xl bg-blue-950/40 border border-blue-500/30 space-y-2.5">
            <div className="flex items-center gap-2 text-blue-300 font-bold text-xs uppercase tracking-wider">
              <CheckCircle2 className="w-4 h-4 text-blue-400" />
              <span>Mandatory Changes & Clarifications Required from College</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {analysis.suggestedChanges?.map((sug: string, idx: number) => (
                <div key={idx} className="p-2.5 rounded-lg bg-white/5 border border-white/5 text-[11px] text-blue-100 flex items-start gap-2">
                  <ArrowRight className="w-3.5 h-3.5 text-blue-400 shrink-0 mt-0.5" />
                  <span>{sug}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Statutory Citations if provided */}
          {analysis.statutoryCitations && analysis.statutoryCitations.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 text-[10px]">
              <span className="text-slate-400 font-semibold">Statutory Basis:</span>
              {analysis.statutoryCitations.map((cite: string, idx: number) => (
                <span key={idx} className="px-2 py-0.5 rounded bg-indigo-900/60 border border-indigo-700/60 text-indigo-200 font-mono">
                  {cite}
                </span>
              ))}
            </div>
          )}

          {/* Draft Officer Remarks with 1-Click Action */}
          <div className="p-4 rounded-xl bg-slate-950/80 border border-amber-400/40 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-amber-400" />
                <span className="text-xs font-bold text-white uppercase tracking-wider">
                  AI Recommended Officer Scrutiny Determination
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-slate-400">Suggested Action:</span>
                <span className="px-2.5 py-0.5 rounded text-[11px] font-black uppercase bg-amber-400 text-slate-950">
                  {analysis.recommendedDecision.replace('_', ' ')}
                </span>
              </div>
            </div>

            <div className="p-3 rounded-lg bg-black/60 border border-white/10 text-slate-200 text-xs font-mono leading-relaxed select-all">
              {analysis.draftOfficerRemarks}
            </div>

            {/* Action Buttons: 1-Click Apply and Copy */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
              <p className="text-[11px] text-slate-400 italic">
                Click below to instantly populate this appraisal into the Official Determination Remarks.
              </p>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleCopyRemarks}
                  className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 border border-white/20 text-xs font-semibold text-white flex items-center gap-1.5 transition"
                >
                  {copiedRemarks ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedRemarks ? 'Copied' : 'Copy Remarks'}</span>
                </button>

                {onApplyRemarks && (
                  <button
                    type="button"
                    onClick={handleApplyToForm}
                    className="px-4 py-1.5 rounded-lg bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-white text-xs font-bold shadow-md shadow-emerald-500/20 flex items-center gap-1.5 transition"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Apply to Officer Remarks (1-Click)</span>
                  </button>
                )}
              </div>
            </div>

            {appliedNotice && (
              <div className="p-2 rounded-lg bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 text-[11px] font-bold flex items-center gap-1.5 animate-in fade-in">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>Remarks and recommended decision applied directly to the Official Scrutiny form!</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
