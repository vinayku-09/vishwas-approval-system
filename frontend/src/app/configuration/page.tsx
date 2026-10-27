'use client';

import React, { useEffect, useState } from 'react';
import {
  Sliders,
  Lock,
  Info,
  Layers,
  Clock,
  BellRing,
  ShieldAlert,
  CalendarCheck,
  AlertTriangle,
  RefreshCw,
  CheckCircle2,
  Bookmark,
  Shield,
} from 'lucide-react';
import { getConfig } from '../../lib/api';
import { ConfigResponse } from '../../lib/types';

export default function ConfigurationPage() {
  const [config, setConfig] = useState<ConfigResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'routes' | 'timelines' | 'reminders' | 'escalations' | 'renewals'>('routes');

  const fetchConfig = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getConfig();
      setConfig(res.data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load configuration');
      setConfig(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConfig();
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 pb-16">
      {/* Top Banner */}
      <div className="bg-gov-blue-900 text-white border-b border-gov-saffron/30 py-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Sliders className="w-6 h-6 text-gov-gold" />
              <span className="text-xs uppercase font-mono tracking-widest text-amber-300">
                AICTE Head Office Governance & Policy Parameters
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight flex items-center gap-2">
              <span>Statutory System Configuration</span>
              <span className="text-xs font-semibold px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-400/30 flex items-center gap-1">
                <Lock className="w-3 h-3" />
                Read-Only
              </span>
            </h1>
            <p className="text-sm text-blue-200 mt-1 max-w-2xl">
              Official approval routes, stage timeline thresholds, reminder cadence, multi-tier
              escalation matrix, and statutory document renewal windows.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={fetchConfig}
              disabled={loading}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 border border-white/20 text-white text-xs font-semibold transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>Refresh Policy</span>
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-4">
        {/* Prominent Statutory Notice */}
        <div className="bg-amber-50 border border-amber-300 rounded-xl p-4 shadow-sm mb-6 flex items-start gap-3">
          <Info className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
          <div className="text-xs text-amber-900">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-bold text-amber-950 uppercase tracking-wide">
                Statutory Notice: Policy Configuration Guard
              </span>
              <span className="inline-flex items-center px-2 py-0.2 rounded font-mono text-[10px] bg-amber-200 text-amber-900 font-bold">
                placeholder pending APH
              </span>
            </div>
            <p className="text-amber-800 leading-relaxed">
              {config?.generalNotice ||
                'All parameters, timelines, reminder offsets, and escalation thresholds shown are provisional guidelines aligned with AICTE Approval Process Handbook (APH) draft standards and are labelled "placeholder pending APH". Modification requires official Gazette publication.'}
            </p>
            {config?.accessedBy && (
              <div className="mt-2 pt-2 border-t border-amber-200/80 text-[11px] text-amber-950/70 flex items-center gap-3">
                <span>Viewed by: <strong>{config.accessedBy.name}</strong> ({config.accessedBy.role})</span>
                <span>•</span>
                <span>Jurisdiction: <strong>{config.accessedBy.region}</strong></span>
              </div>
            )}
          </div>
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-red-600 shrink-0" />
            <div>
              <p className="font-bold">Error loading system configuration</p>
              <p>{error}</p>
            </div>
          </div>
        )}

        {/* Tab Navigation */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-2 mb-6">
          <div className="flex items-center gap-1.5 overflow-x-auto">
            {[
              { id: 'routes', label: '1. Approval Routes', icon: Layers },
              { id: 'timelines', label: '2. Stage Timelines & SLA', icon: Clock },
              { id: 'reminders', label: '3. Reminder Tiers', icon: BellRing },
              { id: 'escalations', label: '4. Escalation Matrix', icon: ShieldAlert },
              { id: 'renewals', label: '5. Renewal Periods', icon: CalendarCheck },
            ].map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                    isActive
                      ? 'bg-gov-blue-900 text-white shadow-sm'
                      : 'text-slate-600 hover:text-gov-blue-900 hover:bg-slate-100'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? 'text-amber-400' : 'text-slate-400'}`} />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Tab 1: Approval Routes */}
        {activeTab === 'routes' && config?.routes && (
          <div className="space-y-4">
            <div className="flex items-center justify-between bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
              <div>
                <h2 className="text-sm font-bold text-slate-900">{config.routes.label}</h2>
                <p className="text-xs text-slate-500">{config.routes.notice}</p>
              </div>
              <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-amber-100 text-amber-800 border border-amber-300 font-mono">
                placeholder pending APH
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {config.routes.items.map((route) => (
                <div
                  key={route.id}
                  className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 hover:shadow-md transition-shadow relative"
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-gov-blue-900 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                          {route.id}
                        </span>
                        <h3 className="font-bold text-sm text-slate-900">{route.name}</h3>
                      </div>
                      <p className="text-xs text-slate-600 mt-1">{route.description}</p>
                    </div>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200 shrink-0">
                      {route.status}
                    </span>
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-100 space-y-2 text-xs">
                    <div>
                      <span className="text-slate-500 font-semibold block text-[11px]">
                        Applicable Application Types:
                      </span>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {route.applicationTypes.map((t) => (
                          <span
                            key={t}
                            className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700"
                          >
                            {t}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div>
                      <span className="text-slate-500 font-semibold block text-[11px]">
                        Required Stages:
                      </span>
                      <div className="flex flex-wrap items-center gap-1 mt-1">
                        {route.stages.map((stage, idx) => (
                          <React.Fragment key={stage}>
                            <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-800 font-mono">
                              {stage}
                            </span>
                            {idx < route.stages.length - 1 && (
                              <span className="text-slate-400 text-[10px]">→</span>
                            )}
                          </React.Fragment>
                        ))}
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-[11px] pt-1">
                      <span className="text-slate-500">Requires EVC Inspection:</span>
                      <span
                        className={`font-bold ${
                          route.requiresEvc ? 'text-amber-600' : 'text-slate-600'
                        }`}
                      >
                        {route.requiresEvc ? 'Yes (Mandatory)' : 'No (Scrutiny Only)'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-slate-500">Final Decision Stage:</span>
                      <span className="font-mono font-bold text-gov-blue-900">
                        {route.decisionStage}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tab 2: Stage Timelines & SLA */}
        {activeTab === 'timelines' && config?.stageTimelines && (
          <div className="space-y-4">
            <div className="flex items-center justify-between bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
              <div>
                <h2 className="text-sm font-bold text-slate-900">{config.stageTimelines.label}</h2>
                <p className="text-xs text-slate-500">{config.stageTimelines.notice}</p>
              </div>
              <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-amber-100 text-amber-800 border border-amber-300 font-mono">
                placeholder pending APH
              </span>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 lg:col-span-1 space-y-3">
                <h3 className="font-bold text-xs uppercase tracking-wider text-slate-700">
                  Global SLA Windows & Thresholds
                </h3>
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between p-2 bg-slate-50 rounded">
                    <span className="text-slate-600">New Institution Total SLA:</span>
                    <span className="font-bold font-mono text-gov-blue-900">
                      {config.stageTimelines.slaWindowsDays.NEW} days
                    </span>
                  </div>
                  <div className="flex justify-between p-2 bg-slate-50 rounded">
                    <span className="text-slate-600">Extension of Approval (EOA):</span>
                    <span className="font-bold font-mono text-gov-blue-900">
                      {config.stageTimelines.slaWindowsDays.EXTENSION} days
                    </span>
                  </div>
                  <div className="flex justify-between p-2 bg-slate-50 rounded">
                    <span className="text-slate-600">Warning Threshold:</span>
                    <span className="font-bold font-mono text-amber-600">
                      {(config.stageTimelines.warningThresholdFraction * 100).toFixed(0)}% of timeline
                    </span>
                  </div>
                  <div className="flex justify-between p-2 bg-slate-50 rounded">
                    <span className="text-slate-600">Approaching SLA Trigger:</span>
                    <span className="font-bold font-mono text-amber-600">
                      ≤ {config.stageTimelines.approachingDaysLeft} days remaining
                    </span>
                  </div>
                  <div className="flex justify-between p-2 bg-slate-50 rounded">
                    <span className="text-slate-600">Ageing Buckets:</span>
                    <span className="font-mono text-slate-700">
                      {config.stageTimelines.ageingBucketEdgesDays.join(', ')} days
                    </span>
                  </div>
                  <div className="flex justify-between p-2 bg-slate-50 rounded">
                    <span className="text-slate-600">Min Land Area Baseline:</span>
                    <span className="font-bold font-mono text-slate-900">
                      {config.stageTimelines.minLandAreaSqmNorm.toLocaleString()} sq.m
                    </span>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 lg:col-span-2">
                <h3 className="font-bold text-xs uppercase tracking-wider text-slate-700 mb-3">
                  Default Processing Days Per Stage
                </h3>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-slate-200 text-xs">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="px-3 py-2 text-left font-bold text-slate-700">Stage</th>
                        <th className="px-3 py-2 text-right font-bold text-slate-700">Days Allowed</th>
                        <th className="px-3 py-2 text-left font-bold text-slate-700">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {Object.entries(config.stageTimelines.defaultDaysPerStage).map(
                        ([stg, days]) => (
                          <tr key={stg} className="hover:bg-slate-50">
                            <td className="px-3 py-2 font-mono text-slate-800">{stg}</td>
                            <td className="px-3 py-2 text-right font-bold font-mono text-gov-blue-900">
                              {days} days
                            </td>
                            <td className="px-3 py-2 font-mono text-[10px] text-amber-800">
                              placeholder pending APH
                            </td>
                          </tr>
                        )
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 3: Reminder Tiers */}
        {activeTab === 'reminders' && config?.reminderTiers && (
          <div className="space-y-4">
            <div className="flex items-center justify-between bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
              <div>
                <h2 className="text-sm font-bold text-slate-900">{config.reminderTiers.label}</h2>
                <p className="text-xs text-slate-500">{config.reminderTiers.notice}</p>
              </div>
              <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-amber-100 text-amber-800 border border-amber-300 font-mono">
                placeholder pending APH
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 space-y-3">
                <h3 className="font-bold text-xs uppercase tracking-wider text-slate-700">
                  Statutory Document Expiry Warning Tiers
                </h3>
                <p className="text-xs text-slate-500">
                  Automated notices dispatched to institutions as compliance certificates near expiry:
                </p>
                <div className="grid grid-cols-3 gap-2 pt-2">
                  {config.reminderTiers.documentExpiryTiersDays.map((tier) => (
                    <div
                      key={tier}
                      className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-center"
                    >
                      <span className="text-[10px] uppercase font-bold text-amber-700 block">
                        Tier Notice
                      </span>
                      <span className="text-xl font-black text-amber-900 font-mono">
                        {tier}d
                      </span>
                      <span className="text-[10px] text-amber-600 block">prior to expiry</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 space-y-3">
                <h3 className="font-bold text-xs uppercase tracking-wider text-slate-700">
                  Operational SLA Reminder Offsets
                </h3>
                <p className="text-xs text-slate-500">
                  {config.reminderTiers.reminderCadenceDescription}
                </p>
                <div className="grid grid-cols-3 gap-2 pt-2">
                  {config.reminderTiers.reminderOffsetsDays.map((offset) => (
                    <div
                      key={offset}
                      className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-center"
                    >
                      <span className="text-[10px] uppercase font-bold text-blue-700 block">
                        Cadence
                      </span>
                      <span className="text-xl font-black text-gov-blue-900 font-mono">
                        {offset}d
                      </span>
                      <span className="text-[10px] text-blue-600 block">before SLA due</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 4: Escalation Matrix */}
        {activeTab === 'escalations' && config?.escalationMatrix && (
          <div className="space-y-4">
            <div className="flex items-center justify-between bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
              <div>
                <h2 className="text-sm font-bold text-slate-900">{config.escalationMatrix.label}</h2>
                <p className="text-xs text-slate-500">{config.escalationMatrix.notice}</p>
              </div>
              <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-amber-100 text-amber-800 border border-amber-300 font-mono">
                placeholder pending APH
              </span>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200 text-xs">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-4 py-3 text-left font-bold text-slate-700">Event Type</th>
                      <th className="px-4 py-3 text-center font-bold text-slate-700">Level</th>
                      <th className="px-4 py-3 text-left font-bold text-slate-700">Trigger Delay</th>
                      <th className="px-4 py-3 text-left font-bold text-slate-700">Escalated To (Role)</th>
                      <th className="px-4 py-3 text-left font-bold text-slate-700">Scope</th>
                      <th className="px-4 py-3 text-right font-bold text-slate-700">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {config.escalationMatrix.matrix.map((row, idx) => (
                      <tr key={idx} className="hover:bg-slate-50">
                        <td className="px-4 py-2.5 font-mono font-semibold text-slate-800">
                          {row.eventType}
                        </td>
                        <td className="px-4 py-2.5 text-center">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono ${
                              row.level === 3
                                ? 'bg-red-100 text-red-800'
                                : row.level === 2
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-blue-100 text-blue-800'
                            }`}
                          >
                            LEVEL {row.level}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-slate-700">
                          {row.delayDescription}
                        </td>
                        <td className="px-4 py-2.5 font-bold text-gov-blue-900">
                          {row.recipientRole}
                        </td>
                        <td className="px-4 py-2.5 text-slate-500">{row.region}</td>
                        <td className="px-4 py-2.5 text-right font-mono text-[10px] text-amber-800">
                          {row.status}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Tab 5: Renewal Periods */}
        {activeTab === 'renewals' && config?.renewalPeriods && (
          <div className="space-y-4">
            <div className="flex items-center justify-between bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
              <div>
                <h2 className="text-sm font-bold text-slate-900">{config.renewalPeriods.label}</h2>
                <p className="text-xs text-slate-500">{config.renewalPeriods.notice}</p>
              </div>
              <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-amber-100 text-amber-800 border border-amber-300 font-mono">
                placeholder pending APH
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
                <h3 className="font-bold text-xs uppercase tracking-wider text-slate-700 mb-3">
                  Statutory Validity Windows by Document Type
                </h3>
                <div className="space-y-2 text-xs">
                  {Object.entries(config.renewalPeriods.statutoryValidityDaysByDocType).map(
                    ([docType, days]) => (
                      <div
                        key={docType}
                        className="flex justify-between items-center p-2.5 bg-slate-50 rounded-lg"
                      >
                        <span className="font-mono text-slate-800 font-semibold">{docType}</span>
                        <div className="text-right">
                          <span className="font-bold font-mono text-gov-blue-900">
                            {days} days
                          </span>
                          <span className="text-[10px] text-slate-400 block">
                            (~{(days / 365).toFixed(1)} yrs)
                          </span>
                        </div>
                      </div>
                    )
                  )}
                </div>
              </div>

              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
                <h3 className="font-bold text-xs uppercase tracking-wider text-slate-700 mb-3">
                  Undertaking Cure Period Windows
                </h3>
                <div className="space-y-2 text-xs">
                  {Object.entries(config.renewalPeriods.categoryDurationsDays).map(
                    ([cat, days]) => (
                      <div
                        key={cat}
                        className="flex justify-between items-center p-2.5 bg-slate-50 rounded-lg"
                      >
                        <span className="text-slate-800 font-medium">{cat}</span>
                        <span className="font-bold font-mono text-amber-800 bg-amber-50 px-2.5 py-1 rounded border border-amber-200">
                          {days} days
                        </span>
                      </div>
                    )
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
