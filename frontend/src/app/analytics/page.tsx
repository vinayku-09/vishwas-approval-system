'use client';

import React, { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import {
  ShieldAlert,
  Info,
  Calendar,
  Filter,
  BarChart3,
  MapPin,
  TrendingUp,
  AlertTriangle,
  RotateCcw,
  CheckCircle,
  FileText,
  Clock,
  ShieldCheck,
  ChevronRight,
  Loader2,
  ExternalLink,
} from 'lucide-react';
import {
  getIrregularityAnalytics,
  getStoredUser,
  getStoredRole,
  setStoredRole,
  IrregularityAnalyticsResponse,
  IrregularityRegionStat,
} from '../../lib/api';
import { Region, Status, AuthUser, Role } from '../../lib/types';
import { StatusBadge } from '../../components/StatusBadge';
import { formatDate } from '../../lib/utils';

const REGION_NAMES: Record<Region, string> = {
  NORTH: 'North Region',
  SOUTH: 'South Region',
  EAST: 'East Region',
  WEST: 'West Region',
  CENTRAL: 'Central Region',
  NORTH_EAST: 'North East Region',
  ALL: 'All Regions',
};

export default function AnalyticsPage() {
  const [mounted, setMounted] = useState(false);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [role, setRole] = useState<Role>('institution');
  const [data, setData] = useState<IrregularityAnalyticsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [fromDate, setFromDate] = useState<string>('');
  const [toDate, setToDate] = useState<string>('');
  const [selectedMetric, setSelectedMetric] = useState<string>('all');
  const [selectedRegion, setSelectedRegion] = useState<Region>('NORTH');

  const isChief = (user && user.role === 'CHIEF') || (!user && role === 'chief');

  const loadAnalytics = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getIrregularityAnalytics({
        fromDate: fromDate || undefined,
        toDate: toDate || undefined,
        metric: selectedMetric !== 'all' ? selectedMetric : undefined,
      });
      setLoading(false);
      if (res.error) {
        setError(res.error);
      } else if (res.data) {
        setData(res.data);
        if (res.data.regions.length > 0 && !res.data.regions.some((r) => r.region === selectedRegion)) {
          setSelectedRegion(res.data.regions[0].region);
        }
      }
    } catch (err: unknown) {
      setLoading(false);
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  useEffect(() => {
    const handleUpdate = () => {
      setUser(getStoredUser());
      setRole(getStoredRole());
    };
    window.addEventListener('aicte_session_changed', handleUpdate);
    window.addEventListener('aicte_role_changed', handleUpdate);
    return () => {
      window.removeEventListener('aicte_session_changed', handleUpdate);
      window.removeEventListener('aicte_role_changed', handleUpdate);
    };
  }, []);

  useEffect(() => {
    setMounted(true);
    const currentUser = getStoredUser();
    const currentRole = getStoredRole();
    setUser(currentUser);
    setRole(currentRole);

    const chiefActive =
      (currentUser && currentUser.role === 'CHIEF') || (!currentUser && currentRole === 'chief');
    if (chiefActive) {
      loadAnalytics();
    } else {
      setLoading(false);
    }
  }, [fromDate, toDate, selectedMetric, role]);

  const activeRegionData = useMemo(() => {
    return data?.regions.find((r) => r.region === selectedRegion);
  }, [data, selectedRegion]);

  const totals = useMemo(() => {
    if (!data) return { score: 0, returns: 0, rejections: 0, overdue: 0, alerts: 0, authRisks: 0 };
    return data.regions.reduce(
      (acc, r) => ({
        score: acc.score + r.irregularityScore,
        returns: acc.returns + r.metrics.returns,
        rejections: acc.rejections + r.metrics.rejections,
        overdue: acc.overdue + r.metrics.overdue,
        alerts: acc.alerts + r.metrics.escalatedAlerts,
        authRisks: acc.authRisks + r.metrics.authenticityRiskFlags,
      }),
      { score: 0, returns: 0, rejections: 0, overdue: 0, alerts: 0, authRisks: 0 }
    );
  }, [data]);

  const maxScore = useMemo(() => {
    if (!data || data.regions.length === 0) return 1;
    return Math.max(...data.regions.map((r) => r.irregularityScore), 1);
  }, [data]);

  const getHeatMapBg = (score: number) => {
    if (score === 0) return 'bg-emerald-50 border-emerald-300 text-emerald-900 hover:bg-emerald-100';
    const ratio = score / maxScore;
    if (ratio < 0.3) return 'bg-amber-50 border-amber-300 text-amber-900 hover:bg-amber-100';
    if (ratio < 0.7) return 'bg-orange-50 border-orange-400 text-orange-900 hover:bg-orange-100';
    return 'bg-red-50 border-red-500 text-red-900 hover:bg-red-100';
  };

  const getScoreBadgeClass = (score: number) => {
    if (score === 0) return 'bg-emerald-100 text-emerald-800 border-emerald-200';
    const ratio = score / maxScore;
    if (ratio < 0.3) return 'bg-amber-100 text-amber-800 border-amber-200';
    if (ratio < 0.7) return 'bg-orange-100 text-orange-800 border-orange-200';
    return 'bg-red-100 text-red-800 border-red-200';
  };

  if (!mounted) {
    return (
      <div suppressHydrationWarning className="max-w-4xl mx-auto px-4 py-16 text-center text-slate-500 text-sm">
        Loading analytics…
      </div>
    );
  }

  if (!isChief) {
    return (
      <div suppressHydrationWarning className="max-w-4xl mx-auto px-4 py-16 text-center">
        <div className="w-16 h-16 mx-auto rounded-full bg-red-100 text-red-600 flex items-center justify-center mb-4">
          <ShieldAlert className="w-8 h-8" />
        </div>
        <h1 className="text-2xl font-extrabold text-slate-900">Head Office Access Only</h1>
        <p className="text-sm text-slate-600 mt-2 max-w-md mx-auto">
          The National Irregularity Analytics & Heat Map is restricted to AICTE Head Office (CHIEF).
          Regional officers and institutions cannot view cross-regional irregularity statistics.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3 mt-6">
          <button
            type="button"
            onClick={() => {
              setStoredRole('chief');
              window.location.reload();
            }}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-gov-blue-900 hover:bg-gov-blue-800 text-white text-xs font-bold transition-colors"
          >
            Switch to Chief Role
          </button>
          <Link
            href="/login"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-slate-300 hover:bg-slate-100 text-slate-700 text-xs font-bold transition-colors"
          >
            Sign in as Chief (chief@aicte.gov.in)
          </Link>
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-slate-500 hover:text-slate-800 text-xs font-semibold"
          >
            Return to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Page Header with Formula Tooltip */}
      <div className="bg-white rounded-2xl p-6 sm:p-8 shadow-sm border border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-gov-blue-50 border border-gov-blue-100 text-[11px] font-bold text-gov-blue-900">
            <ShieldCheck className="w-3.5 h-3.5" />
            AICTE Head Office Oversight
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 mt-2">
            National Irregularity Analytics & Heat Map
          </h1>
          <p className="text-sm text-slate-600 mt-1 max-w-2xl">
            Real-time multi-dimensional irregularity tracking across the 6 AICTE administrative regions
            derived directly from ledger, compliance, return, and escalation records.
          </p>
        </div>

        {/* Formula Explainer Tooltip Card */}
        <div className="relative group self-start md:self-center">
          <div className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-300 text-slate-800 text-xs font-semibold cursor-help hover:border-gov-blue-700 transition-colors">
            <Info className="w-4 h-4 text-gov-blue-700" />
            <span>Irregularity Formula</span>
          </div>

          <div className="absolute right-0 top-full mt-2 w-80 p-4 bg-slate-900 text-white rounded-xl shadow-2xl text-xs z-50 invisible group-hover:visible transition-all opacity-0 group-hover:opacity-100 pointer-events-none space-y-2">
            <p className="font-bold text-gov-gold">Irregularity Calculation Formula:</p>
            <p className="font-mono text-[11px] bg-slate-800 p-2 rounded text-slate-200">
              irregularity = returns + rejections + overdue + escalated alerts + authenticity-risk flags
            </p>
            <ul className="text-[11px] text-slate-300 space-y-1 list-disc pl-4 pt-1">
              <li><strong>Returns:</strong> Procedural reversions due to document/deficiency gaps.</li>
              <li><strong>Rejections:</strong> Cases denied accreditation by committee.</li>
              <li><strong>Overdue:</strong> SLA timeline violations past deadline.</li>
              <li><strong>Escalated alerts:</strong> Unresolved Level 2+ institutional alarms.</li>
              <li><strong>Authenticity risks:</strong> Unverified or expired critical statutory NOCs.</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Filter Controls Bar */}
      <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-200 flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2 text-xs font-bold text-slate-700">
          <Filter className="w-4 h-4 text-gov-blue-700" />
          <span>Filters:</span>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-xs text-slate-500">From:</label>
          <input
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            className="text-xs border border-slate-300 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-gov-blue-700"
          />
        </div>

        <div className="flex items-center gap-2">
          <label className="text-xs text-slate-500">To:</label>
          <input
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            className="text-xs border border-slate-300 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-gov-blue-700"
          />
        </div>

        <div className="flex items-center gap-2">
          <label className="text-xs text-slate-500">Metric Focus:</label>
          <select
            value={selectedMetric}
            onChange={(e) => setSelectedMetric(e.target.value)}
            className="text-xs border border-slate-300 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-gov-blue-700 bg-white"
          >
            <option value="all">All Irregularity Types</option>
            <option value="returns">Returns Only</option>
            <option value="rejections">Rejections Only</option>
            <option value="overdue">Overdue SLA Only</option>
            <option value="escalatedAlerts">Escalated Alerts Only</option>
            <option value="authenticityRiskFlags">Authenticity Risk Only</option>
          </select>
        </div>

        {(fromDate || toDate || selectedMetric !== 'all') && (
          <button
            type="button"
            onClick={() => {
              setFromDate('');
              setToDate('');
              setSelectedMetric('all');
            }}
            className="ml-auto text-xs font-semibold text-slate-500 hover:text-slate-800 underline"
          >
            Reset Filters
          </button>
        )}
      </div>

      {loading ? (
        <div className="py-20 text-center">
          <Loader2 className="w-10 h-10 text-gov-blue-800 animate-spin mx-auto" />
          <p className="text-sm font-bold text-slate-700 mt-4">Aggregating live regional irregularity data...</p>
        </div>
      ) : error ? (
        <div className="p-6 rounded-xl bg-red-50 border border-red-200 text-red-800 text-sm">
          {error}
        </div>
      ) : (
        <>
          {/* Top Aggregated Metric Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-sm">
              <span className="text-[11px] font-bold uppercase text-slate-500 block">Total Score</span>
              <span className="text-2xl font-black text-slate-900 mt-1 block">{totals.score}</span>
              <span className="text-[10px] text-slate-400 mt-0.5 block">Composite national total</span>
            </div>

            <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-sm">
              <span className="text-[11px] font-bold uppercase text-slate-500 block">Returns</span>
              <span className="text-2xl font-black text-amber-600 mt-1 block">{totals.returns}</span>
              <span className="text-[10px] text-slate-400 mt-0.5 block">Reverted for remedy</span>
            </div>

            <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-sm">
              <span className="text-[11px] font-bold uppercase text-slate-500 block">Rejections</span>
              <span className="text-2xl font-black text-red-600 mt-1 block">{totals.rejections}</span>
              <span className="text-[10px] text-slate-400 mt-0.5 block">Final denials</span>
            </div>

            <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-sm">
              <span className="text-[11px] font-bold uppercase text-slate-500 block">Overdue Cases</span>
              <span className="text-2xl font-black text-purple-600 mt-1 block">{totals.overdue}</span>
              <span className="text-[10px] text-slate-400 mt-0.5 block">Breached SLA window</span>
            </div>

            <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-sm">
              <span className="text-[11px] font-bold uppercase text-slate-500 block">Escalated Alerts</span>
              <span className="text-2xl font-black text-rose-600 mt-1 block">{totals.alerts}</span>
              <span className="text-[10px] text-slate-400 mt-0.5 block">Level 2+ escalation</span>
            </div>

            <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-sm">
              <span className="text-[11px] font-bold uppercase text-slate-500 block">Authenticity Flags</span>
              <span className="text-2xl font-black text-indigo-600 mt-1 block">{totals.authRisks}</span>
              <span className="text-[10px] text-slate-400 mt-0.5 block">Statutory NOC alerts</span>
            </div>
          </div>

          {/* India 6-Region Heat Map & Region Performance View */}
          <div className="grid grid-cols-1 lg:grid-cols-[1.1fr_0.9fr] gap-6">
            {/* Heat Map Card */}
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-lg font-bold text-slate-900">India Regional Heat Map</h2>
                  <p className="text-xs text-slate-500">
                    Click a region tile to inspect the applications behind the irregularity score
                  </p>
                </div>
                <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
                  <span className="inline-block w-3 h-3 rounded bg-emerald-200" /> Low
                  <span className="inline-block w-3 h-3 rounded bg-amber-300 ml-1" /> Med
                  <span className="inline-block w-3 h-3 rounded bg-red-400 ml-1" /> High
                </div>
              </div>

              {/* Geographical Grid Layout representing India */}
              <div className="grid grid-cols-3 gap-3 p-4 bg-slate-50 rounded-xl border border-slate-200 min-h-[380px]">
                {/* Row 1: NORTH in Center-North */}
                <div className="col-start-2">
                  {data?.regions.find((r) => r.region === 'NORTH') && (
                    <button
                      type="button"
                      onClick={() => setSelectedRegion('NORTH')}
                      className={`w-full p-4 rounded-xl border-2 text-left transition-all ${getHeatMapBg(
                        data.regions.find((r) => r.region === 'NORTH')!.irregularityScore
                      )} ${selectedRegion === 'NORTH' ? 'ring-4 ring-gov-blue-700/40 font-bold shadow-md' : ''}`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-extrabold text-sm">NORTH</span>
                        <span
                          className={`text-xs px-2 py-0.5 rounded-full font-black border ${getScoreBadgeClass(
                            data.regions.find((r) => r.region === 'NORTH')!.irregularityScore
                          )}`}
                        >
                          {data.regions.find((r) => r.region === 'NORTH')!.irregularityScore} pts
                        </span>
                      </div>
                      <p className="text-[10px] mt-1 opacity-80">Delhi, Punjab, Haryana, HP, J&K</p>
                    </button>
                  )}
                </div>

                {/* Row 2: WEST, CENTRAL, EAST, NORTH_EAST */}
                <div className="col-span-3 grid grid-cols-4 gap-2">
                  {/* WEST */}
                  {data?.regions.find((r) => r.region === 'WEST') && (
                    <button
                      type="button"
                      onClick={() => setSelectedRegion('WEST')}
                      className={`p-3 rounded-xl border-2 text-left transition-all ${getHeatMapBg(
                        data.regions.find((r) => r.region === 'WEST')!.irregularityScore
                      )} ${selectedRegion === 'WEST' ? 'ring-4 ring-gov-blue-700/40 font-bold shadow-md' : ''}`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-extrabold text-xs">WEST</span>
                        <span
                          className={`text-[10px] px-1.5 py-0.2 rounded-full font-black border ${getScoreBadgeClass(
                            data.regions.find((r) => r.region === 'WEST')!.irregularityScore
                          )}`}
                        >
                          {data.regions.find((r) => r.region === 'WEST')!.irregularityScore}
                        </span>
                      </div>
                      <p className="text-[10px] mt-1 opacity-80">MH, GJ, Goa</p>
                    </button>
                  )}

                  {/* CENTRAL */}
                  {data?.regions.find((r) => r.region === 'CENTRAL') && (
                    <button
                      type="button"
                      onClick={() => setSelectedRegion('CENTRAL')}
                      className={`p-3 rounded-xl border-2 text-left transition-all ${getHeatMapBg(
                        data.regions.find((r) => r.region === 'CENTRAL')!.irregularityScore
                      )} ${selectedRegion === 'CENTRAL' ? 'ring-4 ring-gov-blue-700/40 font-bold shadow-md' : ''}`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-extrabold text-xs">CENTRAL</span>
                        <span
                          className={`text-[10px] px-1.5 py-0.2 rounded-full font-black border ${getScoreBadgeClass(
                            data.regions.find((r) => r.region === 'CENTRAL')!.irregularityScore
                          )}`}
                        >
                          {data.regions.find((r) => r.region === 'CENTRAL')!.irregularityScore}
                        </span>
                      </div>
                      <p className="text-[10px] mt-1 opacity-80">MP, CG, UP, RJ</p>
                    </button>
                  )}

                  {/* EAST */}
                  {data?.regions.find((r) => r.region === 'EAST') && (
                    <button
                      type="button"
                      onClick={() => setSelectedRegion('EAST')}
                      className={`p-3 rounded-xl border-2 text-left transition-all ${getHeatMapBg(
                        data.regions.find((r) => r.region === 'EAST')!.irregularityScore
                      )} ${selectedRegion === 'EAST' ? 'ring-4 ring-gov-blue-700/40 font-bold shadow-md' : ''}`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-extrabold text-xs">EAST</span>
                        <span
                          className={`text-[10px] px-1.5 py-0.2 rounded-full font-black border ${getScoreBadgeClass(
                            data.regions.find((r) => r.region === 'EAST')!.irregularityScore
                          )}`}
                        >
                          {data.regions.find((r) => r.region === 'EAST')!.irregularityScore}
                        </span>
                      </div>
                      <p className="text-[10px] mt-1 opacity-80">WB, BH, JH, OR</p>
                    </button>
                  )}

                  {/* NORTH_EAST */}
                  {data?.regions.find((r) => r.region === 'NORTH_EAST') && (
                    <button
                      type="button"
                      onClick={() => setSelectedRegion('NORTH_EAST')}
                      className={`p-3 rounded-xl border-2 text-left transition-all ${getHeatMapBg(
                        data.regions.find((r) => r.region === 'NORTH_EAST')!.irregularityScore
                      )} ${selectedRegion === 'NORTH_EAST' ? 'ring-4 ring-gov-blue-700/40 font-bold shadow-md' : ''}`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-extrabold text-xs">N. EAST</span>
                        <span
                          className={`text-[10px] px-1.5 py-0.2 rounded-full font-black border ${getScoreBadgeClass(
                            data.regions.find((r) => r.region === 'NORTH_EAST')!.irregularityScore
                          )}`}
                        >
                          {data.regions.find((r) => r.region === 'NORTH_EAST')!.irregularityScore}
                        </span>
                      </div>
                      <p className="text-[10px] mt-1 opacity-80">AS, ML, MN, TR</p>
                    </button>
                  )}
                </div>

                {/* Row 3: SOUTH in Center-South */}
                <div className="col-start-2">
                  {data?.regions.find((r) => r.region === 'SOUTH') && (
                    <button
                      type="button"
                      onClick={() => setSelectedRegion('SOUTH')}
                      className={`w-full p-4 rounded-xl border-2 text-left transition-all ${getHeatMapBg(
                        data.regions.find((r) => r.region === 'SOUTH')!.irregularityScore
                      )} ${selectedRegion === 'SOUTH' ? 'ring-4 ring-gov-blue-700/40 font-bold shadow-md' : ''}`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-extrabold text-sm">SOUTH</span>
                        <span
                          className={`text-xs px-2 py-0.5 rounded-full font-black border ${getScoreBadgeClass(
                            data.regions.find((r) => r.region === 'SOUTH')!.irregularityScore
                          )}`}
                        >
                          {data.regions.find((r) => r.region === 'SOUTH')!.irregularityScore} pts
                        </span>
                      </div>
                      <p className="text-[10px] mt-1 opacity-80">TN, KA, KL, AP, TS</p>
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Region Details Breakdown Card */}
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <MapPin className="w-5 h-5 text-gov-blue-800" />
                    <h3 className="text-lg font-bold text-slate-900">
                      {REGION_NAMES[selectedRegion]} Breakdown
                    </h3>
                  </div>
                  <span className="text-xs px-2.5 py-1 rounded-full bg-gov-blue-50 text-gov-blue-900 font-extrabold">
                    Total Score: {activeRegionData?.irregularityScore || 0}
                  </span>
                </div>

                <div className="mt-5 space-y-3">
                  <div className="flex items-center justify-between p-3 rounded-lg bg-slate-50 border border-slate-200">
                    <span className="text-xs font-semibold text-slate-700">Returns Recorded</span>
                    <span className="text-xs font-bold text-amber-700">
                      {activeRegionData?.metrics.returns || 0}
                    </span>
                  </div>

                  <div className="flex items-center justify-between p-3 rounded-lg bg-slate-50 border border-slate-200">
                    <span className="text-xs font-semibold text-slate-700">Applications Rejected</span>
                    <span className="text-xs font-bold text-red-700">
                      {activeRegionData?.metrics.rejections || 0}
                    </span>
                  </div>

                  <div className="flex items-center justify-between p-3 rounded-lg bg-slate-50 border border-slate-200">
                    <span className="text-xs font-semibold text-slate-700">Overdue SLA Approvals</span>
                    <span className="text-xs font-bold text-purple-700">
                      {activeRegionData?.metrics.overdue || 0}
                    </span>
                  </div>

                  <div className="flex items-center justify-between p-3 rounded-lg bg-slate-50 border border-slate-200">
                    <span className="text-xs font-semibold text-slate-700">Active Escalated Alerts</span>
                    <span className="text-xs font-bold text-rose-700">
                      {activeRegionData?.metrics.escalatedAlerts || 0}
                    </span>
                  </div>

                  <div className="flex items-center justify-between p-3 rounded-lg bg-slate-50 border border-slate-200">
                    <span className="text-xs font-semibold text-slate-700">Authenticity / Risk Flags</span>
                    <span className="text-xs font-bold text-indigo-700">
                      {activeRegionData?.metrics.authenticityRiskFlags || 0}
                    </span>
                  </div>
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-slate-200 text-xs text-slate-500">
                Clicking different region cards updates the detailed case ledger below.
              </div>
            </div>
          </div>

          {/* Region-wise Trend Over Time (Bar Chart) */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-slate-900">
                  Regional Irregularities Trend (Past 6 Months)
                </h3>
                <p className="text-xs text-slate-500">
                  Monthly irregularity occurrences tracked per administrative region
                </p>
              </div>
              <TrendingUp className="w-5 h-5 text-gov-blue-800" />
            </div>

            <div className="overflow-x-auto">
              <div className="min-w-[600px] grid grid-cols-6 gap-4 pt-6">
                {data?.timeSeries.map((entry) => {
                  const period = String(entry.period);
                  return (
                    <div key={period} className="flex flex-col items-center gap-2">
                      <div className="w-full h-40 bg-slate-50 rounded-lg flex items-end justify-center p-2 gap-1 border border-slate-200">
                        {(['NORTH', 'SOUTH', 'EAST', 'WEST', 'CENTRAL', 'NORTH_EAST'] as Region[]).map(
                          (reg) => {
                            const val = Number(entry[reg] || 0);
                            const heightPercent = Math.min(100, Math.max(10, val * 25));
                            const isSelected = reg === selectedRegion;
                            return (
                              <div
                                key={reg}
                                style={{ height: `${heightPercent}%` }}
                                title={`${reg}: ${val} irregularities in ${period}`}
                                className={`flex-1 rounded-t transition-all ${
                                  isSelected ? 'bg-gov-blue-800' : 'bg-slate-300 hover:bg-slate-400'
                                }`}
                              />
                            );
                          }
                        )}
                      </div>
                      <span className="text-[11px] font-mono text-slate-600">{period}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-4 pt-2 text-[11px] text-slate-600 border-t border-slate-100">
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded bg-gov-blue-800 inline-block" />
                <span>Selected Region ({selectedRegion})</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded bg-slate-300 inline-block" />
                <span>Other Regions</span>
              </div>
            </div>
          </div>

          {/* Drill-down Applications Behind the Number */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-slate-900">
                  Applications Behind the Numbers ({REGION_NAMES[selectedRegion]})
                </h3>
                <p className="text-xs text-slate-500">
                  Showing {activeRegionData?.applications.length || 0} applications contributing to this region's irregularity score
                </p>
              </div>
            </div>

            {activeRegionData?.applications.length === 0 ? (
              <div className="py-10 text-center text-slate-500 text-xs">
                No irregularities recorded in this region matching current filter criteria.
              </div>
            ) : (
              <div className="overflow-x-auto border border-slate-200 rounded-xl">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase font-bold text-[10px]">
                    <tr>
                      <th className="px-4 py-3">Application ID</th>
                      <th className="px-4 py-3">Institution Name</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3 text-center">Returns</th>
                      <th className="px-4 py-3 text-center">Rejected</th>
                      <th className="px-4 py-3 text-center">Overdue</th>
                      <th className="px-4 py-3 text-center">Escalated</th>
                      <th className="px-4 py-3 text-center">Auth Risk</th>
                      <th className="px-4 py-3 text-right">Score</th>
                      <th className="px-4 py-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {activeRegionData?.applications.map((app) => (
                      <tr key={app.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-4 py-3 font-mono font-bold text-gov-blue-900">
                          {app.id}
                        </td>
                        <td className="px-4 py-3 font-semibold text-slate-800">
                          {app.institutionName}
                        </td>
                        <td className="px-4 py-3">
                          <StatusBadge status={app.status} size="sm" />
                        </td>
                        <td className="px-4 py-3 text-center font-bold">
                          {app.returns > 0 ? (
                            <span className="text-amber-700">{app.returns}</span>
                          ) : (
                            <span className="text-slate-400">0</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {app.isRejected ? (
                            <span className="px-2 py-0.5 rounded bg-red-100 text-red-800 font-bold text-[10px]">
                              YES
                            </span>
                          ) : (
                            <span className="text-slate-400">-</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {app.isOverdue ? (
                            <span className="px-2 py-0.5 rounded bg-purple-100 text-purple-800 font-bold text-[10px]">
                              OVERDUE
                            </span>
                          ) : (
                            <span className="text-slate-400">-</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {app.escalatedAlerts > 0 ? (
                            <span className="text-rose-700 font-bold">{app.escalatedAlerts}</span>
                          ) : (
                            <span className="text-slate-400">0</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {app.authenticityRisk ? (
                            <span className="px-2 py-0.5 rounded bg-indigo-100 text-indigo-800 font-bold text-[10px]">
                              RISK
                            </span>
                          ) : (
                            <span className="text-slate-400">-</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right font-black text-slate-900">
                          {app.irregularityScore}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Link
                            href={`/case-summary/${app.id}`}
                            className="inline-flex items-center gap-1 text-[11px] font-bold text-gov-blue-700 hover:text-gov-blue-900"
                          >
                            Case Summary <ExternalLink className="w-3 h-3" />
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
