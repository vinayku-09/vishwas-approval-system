'use client';

import React, { useEffect, useState, useMemo } from 'react';
import {
  ShieldCheck,
  ShieldAlert,
  Search,
  Filter,
  Calendar,
  Lock,
  Hash,
  User,
  Building,
  RefreshCw,
  Clock,
  ArrowRight,
  ExternalLink,
  CheckCircle2,
  AlertOctagon,
  ChevronRight,
  Database,
} from 'lucide-react';
import {
  getAuditTrail,
  getStoredRole,
  getStoredUser,
} from '../../lib/api';
import {
  AuditTrailEntry,
  AuditTrailResponse,
  AuthUser,
} from '../../lib/types';
import Link from 'next/link';

export default function AuditTrailPage() {
  const [data, setData] = useState<AuditTrailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [eventTypeFilter, setEventTypeFilter] = useState('');
  const [actorFilter, setActorFilter] = useState('');
  const [regionFilter, setRegionFilter] = useState('');
  const [applicationIdFilter, setApplicationIdFilter] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [quickSearch, setQuickSearch] = useState('');

  // Selected Entry modal/details
  const [selectedEntry, setSelectedEntry] = useState<AuditTrailEntry | null>(null);

  const [user, setUser] = useState<AuthUser | null>(null);
  const [role, setRole] = useState('institution');

  useEffect(() => {
    setUser(getStoredUser());
    setRole(getStoredRole());
    const onSession = () => {
      setUser(getStoredUser());
      setRole(getStoredRole());
    };
    window.addEventListener('aicte_session_changed', onSession);
    window.addEventListener('aicte_role_changed', onSession);
    return () => {
      window.removeEventListener('aicte_session_changed', onSession);
      window.removeEventListener('aicte_role_changed', onSession);
    };
  }, []);

  const fetchAuditData = async () => {
    setLoading(true);
    setError(null);
    try {
      const filters: {
        eventType?: string;
        actor?: string;
        region?: string;
        applicationId?: string;
        fromDate?: string;
        toDate?: string;
      } = {};
      if (eventTypeFilter) filters.eventType = eventTypeFilter;
      if (actorFilter) filters.actor = actorFilter;
      if (regionFilter) filters.region = regionFilter;
      if (applicationIdFilter) filters.applicationId = applicationIdFilter;
      if (fromDate) filters.fromDate = fromDate;
      if (toDate) filters.toDate = toDate;

      const res = await getAuditTrail(filters);
      setData(res.data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load immutable audit trail');
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAuditData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventTypeFilter, actorFilter, regionFilter, applicationIdFilter, fromDate, toDate]);

  const handleResetFilters = () => {
    setEventTypeFilter('');
    setActorFilter('');
    setRegionFilter('');
    setApplicationIdFilter('');
    setFromDate('');
    setToDate('');
    setQuickSearch('');
  };

  const filteredEntries = useMemo(() => {
    if (!data?.entries) return [];
    if (!quickSearch.trim()) return data.entries;
    const q = quickSearch.toLowerCase();
    return data.entries.filter(
      (e) =>
        e.id.toLowerCase().includes(q) ||
        e.applicationId.toLowerCase().includes(q) ||
        e.institutionName.toLowerCase().includes(q) ||
        e.eventType.toLowerCase().includes(q) ||
        e.actor.toLowerCase().includes(q) ||
        e.hash.toLowerCase().includes(q)
    );
  }, [data?.entries, quickSearch]);

  const isChief = role.toLowerCase() === 'chief' || user?.role === 'CHIEF';

  return (
    <div className="min-h-screen bg-slate-50 pb-16">
      {/* Top Banner */}
      <div className="bg-gov-blue-900 text-white border-b border-gov-saffron/30 py-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <ShieldCheck className="w-6 h-6 text-emerald-400" />
              <span className="text-xs uppercase font-mono tracking-widest text-emerald-300">
                AICTE SHA-256 Cryptographic Audit Ledger
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              Head-Office Immutable Audit Trail
            </h1>
            <p className="text-sm text-blue-200 mt-1 max-w-2xl">
              Strictly append-only ledger tracking every scrutiny transition, EVC inspection,
              undertaking action, return event, and officer sign-off with SHA-256 hash chaining.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={fetchAuditData}
              disabled={loading}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-white/10 hover:bg-white/20 border border-white/20 text-white text-xs font-semibold transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>Verify & Refresh</span>
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-4">
        {/* KPI Metrics */}
        {data?.summary && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
              <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
                <span>Total Audit Entries</span>
                <Database className="w-4 h-4 text-gov-blue-800" />
              </div>
              <p className="text-2xl font-black text-gov-blue-900 mt-1">
                {data.summary.totalEntries}
              </p>
              <p className="text-[11px] text-slate-400 mt-0.5">Matching active filters</p>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
              <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
                <span>Applications Audited</span>
                <Building className="w-4 h-4 text-slate-600" />
              </div>
              <p className="text-2xl font-black text-slate-800 mt-1">
                {data.summary.applicationsAudited}
              </p>
              <p className="text-[11px] text-slate-400 mt-0.5">Distinct institutions</p>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
              <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
                <span>Verified Chains</span>
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
              </div>
              <p className="text-2xl font-black text-emerald-600 mt-1">
                {data.summary.verifiedChains}
              </p>
              <p className="text-[11px] text-emerald-600 font-medium mt-0.5">Cryptographically unbroken</p>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
              <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
                <span>Broken / Tampered</span>
                <AlertOctagon className="w-4 h-4 text-red-600" />
              </div>
              <p className={`text-2xl font-black mt-1 ${data.summary.brokenChains > 0 ? 'text-red-600' : 'text-slate-400'}`}>
                {data.summary.brokenChains}
              </p>
              <p className="text-[11px] text-slate-400 mt-0.5">Integrity anomalies</p>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 mb-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3 items-end">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Event Type
              </label>
              <select
                value={eventTypeFilter}
                onChange={(e) => setEventTypeFilter(e.target.value)}
                className="w-full text-xs rounded-lg border-slate-300 shadow-sm focus:border-gov-blue-800 focus:ring-gov-blue-800"
              >
                <option value="">All Event Types</option>
                {data?.summary?.allEventTypes?.map((et) => (
                  <option key={et} value={et}>
                    {et}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Actor
              </label>
              <select
                value={actorFilter}
                onChange={(e) => setActorFilter(e.target.value)}
                className="w-full text-xs rounded-lg border-slate-300 shadow-sm focus:border-gov-blue-800 focus:ring-gov-blue-800"
              >
                <option value="">All Actors</option>
                {data?.summary?.allActors?.map((act) => (
                  <option key={act} value={act}>
                    {act}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Region
              </label>
              <select
                value={regionFilter}
                onChange={(e) => setRegionFilter(e.target.value)}
                className="w-full text-xs rounded-lg border-slate-300 shadow-sm focus:border-gov-blue-800 focus:ring-gov-blue-800"
              >
                <option value="">All Regions</option>
                <option value="NORTH">North</option>
                <option value="SOUTH">South</option>
                <option value="EAST">East</option>
                <option value="WEST">West</option>
                <option value="CENTRAL">Central</option>
                <option value="NORTH_EAST">North East</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Application ID
              </label>
              <input
                type="text"
                placeholder="e.g. APP-DEMO-001"
                value={applicationIdFilter}
                onChange={(e) => setApplicationIdFilter(e.target.value)}
                className="w-full text-xs rounded-lg border-slate-300 shadow-sm focus:border-gov-blue-800 focus:ring-gov-blue-800"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Quick Search
              </label>
              <input
                type="text"
                placeholder="Hash, payload, id..."
                value={quickSearch}
                onChange={(e) => setQuickSearch(e.target.value)}
                className="w-full text-xs rounded-lg border-slate-300 shadow-sm focus:border-gov-blue-800 focus:ring-gov-blue-800"
              />
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleResetFilters}
                className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors"
              >
                Reset
              </button>
              <button
                type="button"
                onClick={fetchAuditData}
                className="flex-1 px-3 py-2 bg-gov-blue-900 rounded-lg text-xs font-semibold text-white hover:bg-gov-blue-950 transition-colors"
              >
                Apply
              </button>
            </div>
          </div>
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs flex items-center gap-3">
            <ShieldAlert className="w-5 h-5 text-red-600 shrink-0" />
            <div>
              <p className="font-bold">Access or Ledger Query Error</p>
              <p>{error}</p>
            </div>
          </div>
        )}

        {/* Ledger Entries Table */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <span>Cryptographic Ledger Entries</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 font-semibold">
                  {filteredEntries.length} records
                </span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Every record cryptographically points to its ancestor hash.
              </p>
            </div>
          </div>

          {loading ? (
            <div className="p-12 text-center text-slate-500">
              <RefreshCw className="w-8 h-8 mx-auto animate-spin text-gov-blue-900 mb-3" />
              <p className="text-xs font-semibold">Verifying cryptographic hash chains across applications...</p>
            </div>
          ) : filteredEntries.length === 0 ? (
            <div className="p-12 text-center text-slate-500">
              <Lock className="w-10 h-10 mx-auto text-slate-300 mb-2" />
              <p className="text-sm font-semibold text-slate-700">No ledger entries match query</p>
              <p className="text-xs text-slate-400 mt-1">Try resetting filters or checking application ID.</p>
            </div>
          ) : (
            <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
              <table className="min-w-full divide-y divide-slate-200 text-left text-xs">
                <thead className="bg-slate-50 sticky top-0 z-10 border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3 font-bold text-slate-700 uppercase tracking-wider">
                      Timestamp / App ID
                    </th>
                    <th className="px-4 py-3 font-bold text-slate-700 uppercase tracking-wider">
                      Event Type
                    </th>
                    <th className="px-4 py-3 font-bold text-slate-700 uppercase tracking-wider">
                      Actor
                    </th>
                    <th className="px-4 py-3 font-bold text-slate-700 uppercase tracking-wider">
                      Chain Verification
                    </th>
                    <th className="px-4 py-3 font-bold text-slate-700 uppercase tracking-wider font-mono">
                      Current Block SHA-256
                    </th>
                    <th className="px-4 py-3 font-bold text-slate-700 uppercase tracking-wider text-right">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white">
                  {filteredEntries.map((entry) => {
                    const isValid = entry.verification?.valid;
                    return (
                      <tr
                        key={entry.id}
                        className="hover:bg-blue-50/40 transition-colors odd:bg-white even:bg-slate-50/50"
                      >
                        <td className="px-4 py-3">
                          <div className="font-mono text-[11px] text-slate-500">
                            {new Date(entry.timestamp).toLocaleString()}
                          </div>
                          <div className="font-bold text-gov-blue-900 mt-0.5 flex items-center gap-1.5">
                            <span>{entry.applicationId}</span>
                            <span className="text-[10px] font-normal text-slate-500">
                              ({entry.region})
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-600 truncate max-w-xs" title={entry.institutionName}>
                            {entry.institutionName}
                          </div>
                        </td>

                        <td className="px-4 py-3">
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-slate-100 text-slate-800 border border-slate-200 font-mono">
                            {entry.eventType}
                          </span>
                        </td>

                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5 text-slate-700 font-medium">
                            <User className="w-3.5 h-3.5 text-slate-400" />
                            <span>{entry.actor}</span>
                          </div>
                        </td>

                        <td className="px-4 py-3">
                          {isValid ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
                              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                              VERIFIED
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-800 border border-red-200">
                              <ShieldAlert className="w-3.5 h-3.5 text-red-600" />
                              CHAIN BROKEN
                            </span>
                          )}
                          <div className="text-[10px] text-slate-400 mt-0.5 font-mono">
                            Chain: {entry.verification?.totalEntries || 1} entries
                          </div>
                        </td>

                        <td className="px-4 py-3 font-mono text-[11px]">
                          <div className="text-slate-800 truncate max-w-[180px]" title={entry.hash}>
                            {entry.hash.slice(0, 16)}...
                          </div>
                          <div className="text-slate-400 text-[10px] truncate max-w-[180px]" title={entry.prevHash}>
                            prev: {entry.prevHash ? entry.prevHash.slice(0, 12) + '...' : 'GENESIS'}
                          </div>
                        </td>

                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={() => setSelectedEntry(entry)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-700 text-xs font-semibold transition-colors"
                          >
                            <span>Inspect</span>
                            <ChevronRight className="w-3 h-3" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Entry Detail Modal */}
      {selectedEntry && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto border border-slate-200">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-gov-blue-800" />
                <h3 className="font-bold text-slate-900 text-sm">
                  Cryptographic Ledger Block Inspection
                </h3>
              </div>
              <button
                onClick={() => setSelectedEntry(null)}
                className="text-slate-400 hover:text-slate-700 text-lg font-bold"
              >
                &times;
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200">
                <div>
                  <span className="text-slate-500 font-semibold">Block ID:</span>
                  <p className="font-mono text-slate-900 font-bold">{selectedEntry.id}</p>
                </div>
                <div>
                  <span className="text-slate-500 font-semibold">Application:</span>
                  <p className="font-bold text-gov-blue-900">{selectedEntry.applicationId}</p>
                </div>
                <div>
                  <span className="text-slate-500 font-semibold">Event:</span>
                  <p className="font-mono text-slate-800">{selectedEntry.eventType}</p>
                </div>
                <div>
                  <span className="text-slate-500 font-semibold">Actor:</span>
                  <p className="font-medium text-slate-800">{selectedEntry.actor}</p>
                </div>
                <div className="col-span-2">
                  <span className="text-slate-500 font-semibold">Timestamp:</span>
                  <p className="font-mono text-slate-700">
                    {new Date(selectedEntry.timestamp).toISOString()}
                  </p>
                </div>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  Cryptographic Hash Linkage
                </label>
                <div className="space-y-2">
                  <div className="p-3 bg-slate-100 rounded-lg font-mono text-[11px] break-all border border-slate-200">
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">
                      Previous Block Hash (prevHash):
                    </span>
                    {selectedEntry.prevHash || '0000000000000000000000000000000000000000000000000000000000000000 (GENESIS)'}
                  </div>
                  <div className="p-3 bg-blue-50 rounded-lg font-mono text-[11px] break-all border border-blue-200 text-gov-blue-900">
                    <span className="text-blue-500 block text-[10px] uppercase font-bold">
                      Current Block Hash (SHA-256):
                    </span>
                    {selectedEntry.hash}
                  </div>
                </div>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  Tamper-Evident Payload
                </label>
                <pre className="p-3 bg-slate-900 text-emerald-400 rounded-lg font-mono text-[11px] overflow-x-auto max-h-48 border border-slate-800">
                  {JSON.stringify(selectedEntry.payload, null, 2)}
                </pre>
              </div>

              <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-between">
                <div className="flex items-center gap-2 text-emerald-800 font-semibold">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  <span>Chain Integrity: {selectedEntry.verification?.valid ? 'VERIFIED' : 'TAMPERED'}</span>
                </div>
                <span className="text-[11px] text-emerald-700 font-mono">
                  Chain length: {selectedEntry.verification?.totalEntries || 1}
                </span>
              </div>
            </div>

            <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 flex justify-end">
              <button
                onClick={() => setSelectedEntry(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white text-xs font-semibold rounded-lg"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
