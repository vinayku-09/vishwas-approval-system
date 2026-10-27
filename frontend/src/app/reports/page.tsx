'use client';

import React, { useEffect, useState, useMemo } from 'react';
import {
  FileText,
  Download,
  Filter,
  Calendar,
  MapPin,
  RefreshCw,
  Search,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Layers,
  TrendingUp,
  BarChart3,
  FileSpreadsheet,
  Building,
} from 'lucide-react';
import {
  getReport,
  downloadReportCsv,
  getReportsList,
  getStoredRole,
  getStoredUser,
} from '../../lib/api';
import {
  ReportType,
  ReportResult,
  ReportMeta,
  AuthUser,
} from '../../lib/types';

const REGIONS = [
  { value: '', label: 'All Regions' },
  { value: 'NORTH', label: 'North' },
  { value: 'SOUTH', label: 'South' },
  { value: 'EAST', label: 'East' },
  { value: 'WEST', label: 'West' },
  { value: 'CENTRAL', label: 'Central' },
  { value: 'NORTH_EAST', label: 'North East' },
];

const REPORT_ICONS: Record<ReportType, React.ElementType> = {
  'application-pendency': Clock,
  'evc-status': Layers,
  'undertaking-compliance': CheckCircle2,
  'document-validity': FileText,
  'overdue-cases': AlertTriangle,
  'region-performance': TrendingUp,
};

export default function ReportsPage() {
  const [activeReport, setActiveReport] = useState<ReportType>('application-pendency');
  const [reportsList, setReportsList] = useState<ReportMeta[]>([]);
  const [reportData, setReportData] = useState<ReportResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [selectedRegion, setSelectedRegion] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [tableSearch, setTableSearch] = useState('');

  const [user, setUser] = useState<AuthUser | null>(null);
  const [role, setRole] = useState('institution');

  useEffect(() => {
    setUser(getStoredUser());
    setRole(getStoredRole());
    const onSessionChange = () => {
      setUser(getStoredUser());
      setRole(getStoredRole());
    };
    window.addEventListener('aicte_session_changed', onSessionChange);
    window.addEventListener('aicte_role_changed', onSessionChange);
    return () => {
      window.removeEventListener('aicte_session_changed', onSessionChange);
      window.removeEventListener('aicte_role_changed', onSessionChange);
    };
  }, []);

  // Fetch report list once
  useEffect(() => {
    async function loadList() {
      try {
        const res = await getReportsList();
        if (res.data && res.data.length > 0) {
          setReportsList(res.data);
        }
      } catch (err) {
        console.warn('Failed to load reports metadata:', err);
      }
    }
    loadList();
  }, []);

  // Fetch report data when activeReport or filters change
  const fetchReport = async () => {
    setLoading(true);
    setError(null);
    try {
      const filters: { region?: string; fromDate?: string; toDate?: string } = {};
      if (selectedRegion) filters.region = selectedRegion;
      if (fromDate) filters.fromDate = fromDate;
      if (toDate) filters.toDate = toDate;

      const res = await getReport(activeReport, filters);
      setReportData(res.data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to generate report');
      setReportData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReport();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeReport, selectedRegion, fromDate, toDate]);

  const handleExportCsv = async () => {
    setDownloading(true);
    try {
      await downloadReportCsv(activeReport, {
        region: selectedRegion || undefined,
        fromDate: fromDate || undefined,
        toDate: toDate || undefined,
      });
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'CSV download failed');
    } finally {
      setDownloading(false);
    }
  };

  const handleResetFilters = () => {
    setSelectedRegion('');
    setFromDate('');
    setToDate('');
    setTableSearch('');
  };

  // Client-side search filtering over rows
  const filteredRows = useMemo(() => {
    if (!reportData?.rows) return [];
    if (!tableSearch.trim()) return reportData.rows;
    const q = tableSearch.toLowerCase();
    return reportData.rows.filter((row) =>
      Object.values(row).some(
        (val) => val !== null && val !== undefined && String(val).toLowerCase().includes(q)
      )
    );
  }, [reportData?.rows, tableSearch]);

  const activeMeta = reportsList.find((r) => r.id === activeReport);

  const renderBadge = (key: string, value: any) => {
    const str = String(value);
    if (key.toLowerCase().includes('status') || key.toLowerCase().includes('stage')) {
      if (['ON_TIME', 'VERIFIED', 'COMPLETED', 'VALID', 'ON_TRACK', 'APPROVED'].includes(str.toUpperCase())) {
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
            {str}
          </span>
        );
      }
      if (['OVERDUE', 'REJECTED', 'DELAYED', 'EXPIRED', 'LEVEL_3', 'CRITICAL'].includes(str.toUpperCase())) {
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-red-100 text-red-800 border border-red-200">
            {str}
          </span>
        );
      }
      if (['APPROACHING', 'SUBMITTED', 'PENDING', 'SCHEDULED', 'WARNING', 'LEVEL_1', 'LEVEL_2'].includes(str.toUpperCase())) {
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-200">
            {str}
          </span>
        );
      }
    }
    return <span>{str}</span>;
  };

  return (
    <div className="min-h-screen bg-slate-50 pb-16">
      {/* Top Banner */}
      <div className="bg-gov-blue-900 text-white border-b border-gov-saffron/30 py-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <BarChart3 className="w-6 h-6 text-gov-gold" />
              <span className="text-xs uppercase font-mono tracking-widest text-amber-300">
                AICTE MIS & Executive Reporting Suite
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              Statutory MIS & Performance Reports
            </h1>
            <p className="text-sm text-blue-200 mt-1 max-w-2xl">
              Real-time multi-dimensional analytics covering pendency, EVC visits, undertakings,
              compliance validity, SLA delays, and regional processing performance.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleExportCsv}
              disabled={downloading || loading || !reportData?.rows?.length}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-gov-saffron hover:bg-orange-600 disabled:opacity-50 text-white text-sm font-semibold shadow-md transition-colors"
            >
              <Download className="w-4 h-4" />
              <span>{downloading ? 'Exporting...' : 'Export to CSV'}</span>
            </button>
            <button
              onClick={fetchReport}
              disabled={loading}
              className="p-2.5 rounded-lg bg-white/10 hover:bg-white/20 border border-white/20 text-white transition-colors"
              title="Refresh Report Data"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-4">
        {/* Report Selector Tabs */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-2 overflow-x-auto">
          <div className="flex items-center gap-1.5 min-w-max">
            {(reportsList.length > 0
              ? reportsList
              : [
                  { id: 'application-pendency', title: 'Application Pendency' },
                  { id: 'evc-status', title: 'EVC Status' },
                  { id: 'undertaking-compliance', title: 'Undertaking Compliance' },
                  { id: 'document-validity', title: 'Document Validity' },
                  { id: 'overdue-cases', title: 'Overdue Cases' },
                  { id: 'region-performance', title: 'Region Performance' },
                ]
            ).map((rpt) => {
              const Icon = REPORT_ICONS[rpt.id as ReportType] || FileSpreadsheet;
              const isActive = activeReport === rpt.id;
              return (
                <button
                  key={rpt.id}
                  onClick={() => setActiveReport(rpt.id as ReportType)}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all ${
                    isActive
                      ? 'bg-gov-blue-900 text-white shadow-sm'
                      : 'text-slate-600 hover:text-gov-blue-900 hover:bg-slate-100'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? 'text-amber-400' : 'text-slate-400'}`} />
                  <span>{rpt.title}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Filters Bar */}
        <div className="mt-4 bg-white rounded-xl shadow-sm border border-slate-200 p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 items-end">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-slate-500" />
                Region Scoping
              </label>
              <select
                value={selectedRegion}
                onChange={(e) => setSelectedRegion(e.target.value)}
                className="w-full text-xs rounded-lg border-slate-300 shadow-sm focus:border-gov-blue-800 focus:ring-gov-blue-800"
              >
                {REGIONS.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-slate-500" />
                From Date
              </label>
              <input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="w-full text-xs rounded-lg border-slate-300 shadow-sm focus:border-gov-blue-800 focus:ring-gov-blue-800"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-slate-500" />
                To Date
              </label>
              <input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="w-full text-xs rounded-lg border-slate-300 shadow-sm focus:border-gov-blue-800 focus:ring-gov-blue-800"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1.5">
                <Search className="w-3.5 h-3.5 text-slate-500" />
                Quick Search Rows
              </label>
              <input
                type="text"
                value={tableSearch}
                onChange={(e) => setTableSearch(e.target.value)}
                placeholder="Search any field..."
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
                onClick={fetchReport}
                className="flex-1 px-3 py-2 bg-gov-blue-900 rounded-lg text-xs font-semibold text-white hover:bg-gov-blue-950 transition-colors"
              >
                Apply
              </button>
            </div>
          </div>
        </div>

        {/* Error State */}
        {error && (
          <div className="mt-4 p-4 rounded-xl bg-red-50 border border-red-200 text-red-800 flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-red-600 shrink-0" />
            <div className="text-xs">
              <p className="font-bold">Error generating report:</p>
              <p>{error}</p>
            </div>
          </div>
        )}

        {/* Summary Cards */}
        {reportData?.summary && Object.keys(reportData.summary).length > 0 && (
          <div className="mt-4">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
              Executive Key Performance Indicators
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
              {Object.entries(reportData.summary).map(([key, val]) => (
                <div
                  key={key}
                  className="bg-white rounded-xl shadow-sm border border-slate-200 p-3.5 hover:shadow-md transition-shadow"
                >
                  <p className="text-[11px] font-semibold text-slate-500 truncate" title={key}>
                    {key}
                  </p>
                  <p className="text-xl sm:text-2xl font-black text-gov-blue-900 mt-1">
                    {val}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Main Preview Table */}
        <div className="mt-6 bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div>
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <span>{reportData?.title || activeMeta?.title || 'Report Data'}</span>
                {reportData?.rows && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 font-semibold">
                    {filteredRows.length} {filteredRows.length === 1 ? 'row' : 'rows'}
                  </span>
                )}
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                {activeMeta?.description || 'Scoped statutory records matching active filters.'}
              </p>
            </div>

            <div className="text-right text-[11px] text-slate-400">
              {reportData?.generatedAt && (
                <span>Generated: {new Date(reportData.generatedAt).toLocaleString()}</span>
              )}
            </div>
          </div>

          {loading ? (
            <div className="p-12 text-center text-slate-500">
              <RefreshCw className="w-8 h-8 mx-auto animate-spin text-gov-blue-900 mb-3" />
              <p className="text-xs font-semibold">Aggregating records and compiling report...</p>
            </div>
          ) : filteredRows.length === 0 ? (
            <div className="p-12 text-center text-slate-500">
              <FileSpreadsheet className="w-10 h-10 mx-auto text-slate-300 mb-2" />
              <p className="text-sm font-semibold text-slate-700">No records found</p>
              <p className="text-xs text-slate-400 mt-1">
                Try widening your date range or selecting &quot;All Regions&quot;.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
              <table className="min-w-full divide-y divide-slate-200 text-left text-xs">
                <thead className="bg-slate-50 sticky top-0 z-10 border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3 font-bold text-slate-700 uppercase tracking-wider w-12 text-center">
                      #
                    </th>
                    {reportData?.columns.map((col) => (
                      <th
                        key={col.key}
                        className={`px-4 py-3 font-bold text-slate-700 uppercase tracking-wider ${
                          col.align === 'center'
                            ? 'text-center'
                            : col.align === 'right'
                            ? 'text-right'
                            : 'text-left'
                        }`}
                      >
                        {col.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white">
                  {filteredRows.map((row, idx) => (
                    <tr
                      key={idx}
                      className="hover:bg-blue-50/40 transition-colors odd:bg-white even:bg-slate-50/50"
                    >
                      <td className="px-4 py-2.5 text-center text-slate-400 font-mono text-[11px]">
                        {idx + 1}
                      </td>
                      {reportData?.columns.map((col) => (
                        <td
                          key={col.key}
                          className={`px-4 py-2.5 text-slate-800 ${
                            col.align === 'center'
                              ? 'text-center'
                              : col.align === 'right'
                              ? 'text-right'
                              : 'text-left'
                          }`}
                        >
                          {renderBadge(col.key, row[col.key] ?? '—')}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
