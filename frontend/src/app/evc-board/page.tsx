'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AlertTriangle, Calendar, CheckCircle, Clock, Filter } from 'lucide-react';
import {
  ApiError,
  dashboardRoleView,
  getEvcBoard,
  getStoredUser,
  isAuthenticated,
} from '../../lib/api';
import { AuthUser, DashboardRoleView, EvcBoard, EvcBoardItem } from '../../lib/types';
import { DemoBanner } from '../../components/DemoBanner';
import { SafeguardNotice } from '../../components/SafeguardNotice';

const REGION_OPTIONS = ['ALL', 'NORTH', 'SOUTH', 'EAST', 'WEST', 'CENTRAL', 'NORTH_EAST'];

type BoardChip = 'ALL' | 'awaiting' | 'scheduled' | 'completed' | 'delayed';

const VIEW_COPY: Record<DashboardRoleView, { title: string; subtitle: string }> = {
  regional_officer: {
    title: 'Regional EVC board',
    subtitle: 'Inspection status for applications in your region only.',
  },
  bureau_officer: {
    title: 'Bureau EVC board',
    subtitle: 'All-India awaiting, scheduled, completed and delayed EVC cases.',
  },
  committee: {
    title: 'Committee EVC board',
    subtitle: 'Visit assignments in your region. Delayed reports escalate through the alert engine.',
  },
  head_office: {
    title: 'Head office EVC board',
    subtitle: 'National EVC status including delayed cases that feed alerts and escalations.',
  },
  institution: {
    title: 'My EVC visits',
    subtitle: 'Only Expert Visit Committee activity on your own applications.',
  },
};

function matchesChip(item: EvcBoardItem, chip: BoardChip): boolean {
  if (chip === 'ALL') return true;
  if (chip === 'delayed') return item.delayed;
  if (chip === 'awaiting') return !item.scheduledDate;
  if (chip === 'scheduled') return Boolean(item.scheduledDate) && !item.delayed && item.status !== 'EVC_DONE';
  if (chip === 'completed') return item.status === 'EVC_DONE';
  return true;
}

export default function EvcBoardPage() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [data, setData] = useState<EvcBoard | null>(null);
  const [isDemo, setIsDemo] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [region, setRegion] = useState('ALL');
  const [chip, setChip] = useState<BoardChip>('ALL');

  const view = useMemo(() => data?.roleView || dashboardRoleView(user), [data, user]);
  const copy = VIEW_COPY[view];

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getEvcBoard({ region: region === 'ALL' ? undefined : region });
      setData(res.data);
      setIsDemo(res.isDemo);
    } catch (err: unknown) {
      const message =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
          ? err.message
          : 'Failed to load EVC board';
      setError(message);
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [region]);

  useEffect(() => {
    setMounted(true);
    const current = getStoredUser();
    setUser(current);
    if (!isAuthenticated()) {
      router.replace('/login?next=/evc-board');
      return;
    }
    load();
  }, [load, router]);

  const visibleItems = (data?.items || []).filter((item) => matchesChip(item, chip));

  if (!mounted) {
    return (
      <div suppressHydrationWarning className="max-w-7xl mx-auto px-4 py-8 text-sm text-slate-600">Loading EVC board…</div>
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
            <Calendar className="w-6 h-6" />
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
          <Link href="/dashboard" className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm">
            Pendency Dashboard
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
        <div className="flex flex-wrap gap-2">
          {(['ALL', 'awaiting', 'scheduled', 'completed', 'delayed'] as BoardChip[]).map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setChip(value)}
              className={`px-3 py-1 rounded-full text-xs border ${
                chip === value
                  ? value === 'delayed'
                    ? 'bg-red-600 text-white border-red-600'
                    : 'bg-gov-blue-800 text-white border-gov-blue-800'
                  : 'bg-white text-slate-700 border-slate-200 hover:border-slate-400'
              }`}
            >
              {value === 'ALL' ? 'All' : value.charAt(0).toUpperCase() + value.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {loading && <div className="text-center text-slate-600 py-8">Loading EVC board…</div>}

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">Error: {error}</div>
      )}

      {!loading && !error && data && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white p-4 rounded-lg border border-slate-200">
              <div className="flex items-center gap-2 text-amber-600 text-sm">
                <Clock className="w-4 h-4" />
                Awaiting EVC
              </div>
              <div className="text-2xl font-bold mt-1">{data.awaitingEvc}</div>
            </div>
            <div className="bg-white p-4 rounded-lg border border-slate-200">
              <div className="flex items-center gap-2 text-blue-600 text-sm">
                <Calendar className="w-4 h-4" />
                Scheduled
              </div>
              <div className="text-2xl font-bold mt-1">{data.scheduled}</div>
            </div>
            <div className="bg-white p-4 rounded-lg border border-slate-200">
              <div className="flex items-center gap-2 text-green-600 text-sm">
                <CheckCircle className="w-4 h-4" />
                Completed
              </div>
              <div className="text-2xl font-bold mt-1">{data.completed}</div>
            </div>
            <div className="bg-white p-4 rounded-lg border border-slate-200">
              <div className="flex items-center gap-2 text-red-600 text-sm">
                <AlertTriangle className="w-4 h-4" />
                Delayed
              </div>
              <div className="text-2xl font-bold mt-1">{data.delayed}</div>
            </div>
          </div>

          <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-200 bg-slate-50">
              <h2 className="font-semibold text-slate-900">EVC cases</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-4 py-2 text-left">Application</th>
                    <th className="px-4 py-2 text-left">Institution</th>
                    <th className="px-4 py-2 text-left">Status</th>
                    <th className="px-4 py-2 text-left">Region</th>
                    <th className="px-4 py-2 text-left">Scheduled</th>
                    <th className="px-4 py-2 text-left">Report due</th>
                    <th className="px-4 py-2 text-left">Days overdue</th>
                    <th className="px-4 py-2 text-left">Delayed</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleItems.map((item) => (
                    <tr key={item.applicationId} className="border-t border-slate-100 hover:bg-slate-50">
                      <td className="px-4 py-2 font-mono">
                        <Link href={`/case/${item.applicationId}`} className="text-blue-700 hover:underline">
                          {item.applicationId}
                        </Link>
                      </td>
                      <td className="px-4 py-2">{item.institutionName}</td>
                      <td className="px-4 py-2">{item.status}</td>
                      <td className="px-4 py-2">{item.region || 'ALL'}</td>
                      <td className="px-4 py-2">{item.scheduledDate || '-'}</td>
                      <td className="px-4 py-2">{item.reportDueAt || '-'}</td>
                      <td className="px-4 py-2">{item.daysOverdue || 0}</td>
                      <td className="px-4 py-2">
                        {item.delayed ? (
                          <span className="px-2 py-0.5 rounded text-xs bg-red-100 text-red-700">Yes</span>
                        ) : (
                          <span className="px-2 py-0.5 rounded text-xs bg-green-100 text-green-700">No</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {visibleItems.length === 0 && (
                <div className="px-4 py-8 text-sm text-slate-500 text-center">No EVC cases for this view.</div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
