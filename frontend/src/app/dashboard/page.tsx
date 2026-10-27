'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  AlertTriangle,
  BarChart3,
  Clock,
  FileText,
  Filter,
  Users,
} from 'lucide-react';
import {
  ApiError,
  dashboardRoleView,
  getPendencyDashboard,
  getStoredUser,
  isAuthenticated,
} from '../../lib/api';
import {
  AuthUser,
  DashboardRoleView,
  PendencyDashboard,
  PendencyStatus,
  Status,
} from '../../lib/types';
import { DemoBanner } from '../../components/DemoBanner';
import { SafeguardNotice } from '../../components/SafeguardNotice';

const STAGE_OPTIONS: Status[] = [
  'SUBMITTED',
  'SCRUTINY',
  'DEFICIENT',
  'EVC_REQUIRED',
  'EVC_DONE',
  'DECISION',
  'REJECTED',
  'APPEAL_SHC',
  'APPEAL_SAC',
];

const REGION_OPTIONS = ['ALL', 'NORTH', 'SOUTH', 'EAST', 'WEST', 'CENTRAL', 'NORTH_EAST'];
const STATUS_CHIPS: Array<PendencyStatus | 'ALL'> = ['ALL', 'On time', 'Approaching', 'Overdue'];

const VIEW_COPY: Record<DashboardRoleView, { title: string; subtitle: string }> = {
  regional_officer: {
    title: 'Regional officer pendency',
    subtitle: 'Applications in your region only. Counts, ageing and workload are scoped on the server.',
  },
  bureau_officer: {
    title: 'Bureau officer pendency',
    subtitle: 'All-India bureau view of pending cases, bottlenecks and officer workload.',
  },
  committee: {
    title: 'Committee pendency',
    subtitle: 'Inspection workload for your region. Use the EVC board for visit status.',
  },
  head_office: {
    title: 'Head office pendency',
    subtitle: 'National overview of stage counts, region mix, ageing buckets and bottlenecks.',
  },
  institution: {
    title: 'My applications',
    subtitle: 'Only applications belonging to your institution are shown.',
  },
};

function chipClass(active: boolean, tone: 'green' | 'amber' | 'red' | 'slate') {
  if (active) {
    if (tone === 'green') return 'bg-emerald-600 text-white border-emerald-600';
    if (tone === 'amber') return 'bg-amber-500 text-white border-amber-500';
    if (tone === 'red') return 'bg-red-600 text-white border-red-600';
    return 'bg-gov-blue-800 text-white border-gov-blue-800';
  }
  return 'bg-white text-slate-700 border-slate-200 hover:border-slate-400';
}

export default function DashboardPage() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [data, setData] = useState<PendencyDashboard | null>(null);
  const [isDemo, setIsDemo] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [region, setRegion] = useState('ALL');
  const [stage, setStage] = useState('');
  const [status, setStatus] = useState<PendencyStatus | 'ALL'>('ALL');

  const view = useMemo(() => data?.roleView || dashboardRoleView(user), [data, user]);
  const copy = VIEW_COPY[view];

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getPendencyDashboard({
        region: region === 'ALL' ? undefined : region,
        stage: stage || undefined,
        status: status === 'ALL' ? undefined : status,
      });
      setData(res.data);
      setIsDemo(res.isDemo);
    } catch (err: unknown) {
      const message =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
          ? err.message
          : 'Failed to load pendency dashboard';
      setError(message);
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [region, stage, status]);

  useEffect(() => {
    setMounted(true);
    const current = getStoredUser();
    setUser(current);
    if (!isAuthenticated()) {
      router.replace('/login?next=/dashboard');
      return;
    }
    load();
  }, [load, router]);

  if (!mounted) {
    return (
      <div suppressHydrationWarning className="max-w-7xl mx-auto px-4 py-8 text-sm text-slate-600">Loading dashboard…</div>
    );
  }

  if (!isAuthenticated() && !user) {
    return (
      <div suppressHydrationWarning className="max-w-7xl mx-auto px-4 py-8 text-sm text-slate-600">Redirecting to sign in…</div>
    );
  }

  return (
    <div suppressHydrationWarning className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <DemoBanner />
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <BarChart3 className="w-6 h-6" />
            {copy.title}
          </h1>
          <p className="text-sm text-slate-600 mt-1">{copy.subtitle}</p>
          <p className="text-xs font-medium text-amber-800 bg-amber-50 border border-amber-200 rounded px-2 py-1 mt-2 inline-block">
            Placeholder timelines pending APH
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`text-[11px] font-semibold px-2 py-1 rounded border ${
              isDemo ? 'bg-amber-50 text-amber-800 border-amber-200' : 'bg-emerald-50 text-emerald-800 border-emerald-200'
            }`}
          >
            {isDemo ? 'Mock data' : 'Live API'}
          </span>
          <Link href="/evc-board" className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm">
            EVC Board
          </Link>
        </div>
      </div>

      <SafeguardNotice />

      {data?.note && (
        <p className="text-xs text-slate-600 border border-slate-200 rounded-lg bg-white px-3 py-2">{data.note}</p>
      )}

      <div className="bg-white rounded-lg border border-slate-200 p-4 space-y-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
          <Filter className="w-4 h-4" />
          Filters
        </div>
        <div className="flex flex-wrap gap-3">
          <label className="text-xs text-slate-600">
            Region
            <select
              className="ml-2 border border-slate-200 rounded px-2 py-1 text-sm"
              value={region}
              onChange={(e) => setRegion(e.target.value)}
              disabled={view === 'institution'}
            >
              {REGION_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs text-slate-600">
            Stage
            <select
              className="ml-2 border border-slate-200 rounded px-2 py-1 text-sm"
              value={stage}
              onChange={(e) => setStage(e.target.value)}
            >
              <option value="">All stages</option>
              {STAGE_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="flex flex-wrap gap-2">
          {STATUS_CHIPS.map((chip) => (
            <button
              key={chip}
              type="button"
              onClick={() => setStatus(chip)}
              className={`px-3 py-1 rounded-full text-xs border ${chipClass(
                status === chip,
                chip === 'Overdue' ? 'red' : chip === 'Approaching' ? 'amber' : chip === 'On time' ? 'green' : 'slate'
              )}`}
            >
              {chip}
            </button>
          ))}
        </div>
      </div>

      {loading && <div className="text-center text-slate-600 py-8">Loading dashboard…</div>}

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">Error: {error}</div>
      )}

      {!loading && !error && data && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white p-4 rounded-lg border border-slate-200">
              <div className="flex items-center gap-2 text-slate-600 text-sm">
                <FileText className="w-4 h-4" />
                Total pending
              </div>
              <div className="text-2xl font-bold mt-1">{data.total}</div>
            </div>
            <div className="bg-white p-4 rounded-lg border border-slate-200">
              <div className="flex items-center gap-2 text-amber-600 text-sm">
                <Clock className="w-4 h-4" />
                Bottleneck stages
              </div>
              <div className="text-sm mt-1 space-y-0.5">
                {data.bottleneckStages.length === 0 && <div>None</div>}
                {data.bottleneckStages.map((item) => (
                  <div key={item.stage}>
                    {item.stage}: {item.count}
                  </div>
                ))}
              </div>
            </div>
            <div className="bg-white p-4 rounded-lg border border-slate-200">
              <div className="flex items-center gap-2 text-red-600 text-sm">
                <AlertTriangle className="w-4 h-4" />
                Ageing buckets
              </div>
              <div className="text-sm mt-1">
                {Object.entries(data.ageingBuckets).map(([key, value]) => (
                  <div key={key}>
                    {key}: {value}
                  </div>
                ))}
              </div>
            </div>
            <div className="bg-white p-4 rounded-lg border border-slate-200">
              <div className="flex items-center gap-2 text-blue-600 text-sm">
                <Users className="w-4 h-4" />
                {view === 'committee' ? 'Committee workload' : 'Officer workload'}
              </div>
              <div className="text-sm mt-1 max-h-24 overflow-auto">
                {Object.entries(view === 'committee' ? data.workloadPerCommittee : data.workloadPerOfficer)
                  .slice(0, 8)
                  .map(([key, value]) => (
                    <div key={key}>
                      {key}: {value}
                    </div>
                  ))}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white p-4 rounded-lg border border-slate-200">
              <h2 className="font-semibold text-slate-900 mb-2">Counts by stage</h2>
              <div className="text-sm space-y-1">
                {Object.entries(data.countsByStage).map(([key, value]) => (
                  <div key={key} className="flex justify-between">
                    <span>{key}</span>
                    <span className="font-mono">{value}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="bg-white p-4 rounded-lg border border-slate-200">
              <h2 className="font-semibold text-slate-900 mb-2">Counts by region</h2>
              <div className="text-sm space-y-1">
                {Object.entries(data.countsByRegion).map(([key, value]) => (
                  <div key={key} className="flex justify-between">
                    <span>{key}</span>
                    <span className="font-mono">{value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-200 bg-slate-50">
              <h2 className="font-semibold text-slate-900">Pending cases</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-4 py-2 text-left">Application</th>
                    <th className="px-4 py-2 text-left">Institution</th>
                    <th className="px-4 py-2 text-left">Stage</th>
                    <th className="px-4 py-2 text-left">Region</th>
                    <th className="px-4 py-2 text-left">Age</th>
                    <th className="px-4 py-2 text-left">Days left</th>
                    <th className="px-4 py-2 text-left">Status</th>
                    <th className="px-4 py-2 text-left">Bucket</th>
                  </tr>
                </thead>
                <tbody>
                  {data.pendingCases.map((row) => (
                    <tr key={row.applicationId} className="border-t border-slate-100 hover:bg-slate-50">
                      <td className="px-4 py-2 font-mono">
                        <Link href={`/case/${row.applicationId}`} className="text-blue-700 hover:underline">
                          {row.applicationId}
                        </Link>
                      </td>
                      <td className="px-4 py-2">{row.institutionName}</td>
                      <td className="px-4 py-2">{row.currentStage}</td>
                      <td className="px-4 py-2">{row.region || 'ALL'}</td>
                      <td className="px-4 py-2">{row.ageDays}</td>
                      <td className="px-4 py-2">{row.daysLeft}</td>
                      <td className="px-4 py-2">
                        <span
                          className={`px-2 py-0.5 rounded text-xs ${
                            row.pendencyStatus === 'Overdue'
                              ? 'bg-red-100 text-red-700'
                              : row.pendencyStatus === 'Approaching'
                              ? 'bg-amber-100 text-amber-700'
                              : 'bg-green-100 text-green-700'
                          }`}
                        >
                          {row.pendencyStatus}
                        </span>
                      </td>
                      <td className="px-4 py-2">{row.ageingBucket}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {data.pendingCases.length === 0 && (
                <div className="px-4 py-8 text-sm text-slate-500 text-center">No pending cases for this view.</div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
