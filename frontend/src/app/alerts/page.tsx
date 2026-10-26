'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  BellRing,
  CheckCircle2,
  Clock,
  Filter,
  MapPin,
  RefreshCw,
  ShieldAlert,
  Check,
  X,
} from 'lucide-react';
import {
  acknowledgeEscalation,
  getEscalations,
  getNotifications,
  getStoredRole,
  markNotificationRead,
  resolveEscalation,
} from '../../lib/api';
import {
  AlertEventType,
  Escalation,
  EscalationStatus,
  Notification,
} from '../../lib/types';
import { formatDate } from '../../lib/utils';

const EVENT_LABELS: Record<AlertEventType, string> = {
  PENDENCY: 'Application Pendency',
  EVC_SCHEDULING: 'EVC Scheduling',
  REPORT_SUBMISSION: 'EVC Report Submission',
  UNDERTAKING: 'Pending Undertaking',
  DOCUMENT_EXPIRY: 'Document Expiry',
  DOCUMENT_AUTHENTICITY: 'Document Authenticity',
};

const STATUS_STYLES: Record<EscalationStatus, string> = {
  OPEN: 'bg-red-50 text-red-700 border-red-200',
  ACKNOWLEDGED: 'bg-amber-50 text-amber-800 border-amber-200',
  RESOLVED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
};

type Toast = { message: string; type: 'success' | 'error' } | null;

export default function AlertsPage() {
  const [role, setRole] = useState('institution');
  const [loading, setLoading] = useState(true);
  const [escalations, setEscalations] = useState<Escalation[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [statusFilter, setStatusFilter] = useState<'ALL' | EscalationStatus>('ALL');
  const [eventFilter, setEventFilter] = useState<'ALL' | AlertEventType>('ALL');
  const [remarksById, setRemarksById] = useState<Record<string, string>>({});
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [toast, setToast] = useState<Toast>(null);

  const normalizedRole = role.toUpperCase();
  const isInternal = ['OFFICER', 'COMMITTEE', 'CHIEF'].includes(normalizedRole);

  useEffect(() => {
    setRole(getStoredRole());
    const onRoleChange = () => setRole(getStoredRole());
    window.addEventListener('aicte_role_changed', onRoleChange);
    return () => window.removeEventListener('aicte_role_changed', onRoleChange);
  }, []);

  const load = async () => {
    setLoading(true);
    try {
      const notifRes = await getNotifications();
      setNotifications(notifRes.data || []);
      if (isInternal) {
        const escRes = await getEscalations();
        setEscalations(escRes.data || []);
      }
    } catch (err: unknown) {
      setToast({
        message: err instanceof Error ? err.message : 'Failed to load alerts',
        type: 'error',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isInternal]);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(timer);
  }, [toast]);

  const filteredEscalations = useMemo(() => {
    return escalations.filter((e) => {
      if (statusFilter !== 'ALL' && e.status !== statusFilter) return false;
      if (eventFilter !== 'ALL' && e.eventType !== eventFilter) return false;
      return true;
    });
  }, [escalations, statusFilter, eventFilter]);

  const stats = useMemo(() => {
    return {
      open: escalations.filter((e) => e.status === 'OPEN').length,
      acknowledged: escalations.filter((e) => e.status === 'ACKNOWLEDGED').length,
      resolved: escalations.filter((e) => e.status === 'RESOLVED').length,
      reminders: notifications.filter((n) => !n.read).length,
    };
  }, [escalations, notifications]);

  const handleAcknowledge = async (id: string) => {
    setBusyId(id);
    const res = await acknowledgeEscalation(id);
    setBusyId(null);
    if (res.error) {
      setToast({ message: res.error, type: 'error' });
      return;
    }
    setEscalations((prev) =>
      prev.map((e) => (e.id === id ? { ...e, status: 'ACKNOWLEDGED' } : e))
    );
    setToast({ message: 'Escalation acknowledged.', type: 'success' });
  };

  const handleResolve = async (id: string) => {
    const remarks = (remarksById[id] || '').trim();
    if (!remarks) {
      setToast({ message: 'Enter resolution remarks before resolving.', type: 'error' });
      return;
    }
    setBusyId(id);
    const res = await resolveEscalation(id, remarks);
    setBusyId(null);
    if (res.error) {
      setToast({ message: res.error, type: 'error' });
      return;
    }
    setEscalations((prev) =>
      prev.map((e) =>
        e.id === id ? { ...e, status: 'RESOLVED', remarks } : e
      )
    );
    setResolvingId(null);
    setToast({ message: 'Escalation resolved and recorded in the audit ledger.', type: 'success' });
  };

  const handleMarkRead = async (id: string) => {
    await markNotificationRead(id);
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">

      {toast && (
        <div
          className={`fixed top-24 right-6 z-50 px-4 py-3 rounded-lg shadow-xl text-sm font-semibold border ${
            toast.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
              : 'bg-red-50 text-red-800 border-red-200'
          }`}
        >
          {toast.message}
        </div>
      )}

      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 flex items-center gap-2">
            <BellRing className="w-6 h-6 text-gov-saffron" />
            Alerts & Escalations
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Daily reminders and rule-based escalations for pendency, EVC scheduling, reports,
            undertakings and document expiry. Every dispatch is written to the audit ledger exactly once.
          </p>
        </div>
        <button
          type="button"
          onClick={load}
          className="inline-flex items-center gap-2 self-start md:self-auto px-3.5 py-2 rounded-lg bg-gov-blue-900 text-white text-xs font-bold hover:bg-gov-blue-950 transition-colors"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Open escalations', value: stats.open, color: 'text-red-700', bg: 'bg-red-50 border-red-100', icon: ShieldAlert },
          { label: 'Acknowledged', value: stats.acknowledged, color: 'text-amber-700', bg: 'bg-amber-50 border-amber-100', icon: Clock },
          { label: 'Resolved', value: stats.resolved, color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-100', icon: CheckCircle2 },
          { label: 'Unread reminders', value: stats.reminders, color: 'text-blue-700', bg: 'bg-blue-50 border-blue-100', icon: AlertTriangle },
        ].map((card) => (
          <div key={card.label} className={`rounded-xl border p-4 ${card.bg}`}>
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                {card.label}
              </span>
              <card.icon className={`w-4 h-4 ${card.color}`} />
            </div>
            <p className={`text-2xl font-extrabold mt-2 ${card.color}`}>{card.value}</p>
          </div>
        ))}
      </div>

      {isInternal ? (
        <>
          <div className="bg-white rounded-xl border border-slate-200 p-4 flex flex-col lg:flex-row lg:items-center gap-3 justify-between">
            <div className="flex items-center gap-2 flex-wrap">
              <Filter className="w-4 h-4 text-slate-500" />
              {(['ALL', 'OPEN', 'ACKNOWLEDGED', 'RESOLVED'] as const).map((status) => (
                <button
                  key={status}
                  type="button"
                  onClick={() => setStatusFilter(status)}
                  className={`px-3 py-1.5 rounded-md text-xs font-bold border transition-colors ${
                    statusFilter === status
                      ? 'bg-gov-blue-900 text-white border-gov-blue-900'
                      : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  {status === 'ALL' ? 'All statuses' : status}
                </button>
              ))}
            </div>
            <select
              value={eventFilter}
              onChange={(e) => setEventFilter(e.target.value as 'ALL' | AlertEventType)}
              className="px-3 py-2 rounded-md border border-slate-200 text-xs font-semibold text-slate-700 bg-white"
            >
              <option value="ALL">All alert types</option>
              {Object.entries(EVENT_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-3">
            {loading ? (
              <div className="bg-white border border-slate-200 rounded-xl p-10 text-center text-sm text-slate-500">
                Loading escalations…
              </div>
            ) : filteredEscalations.length === 0 ? (
              <div className="bg-white border border-slate-200 rounded-xl p-10 text-center">
                <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-3" />
                <p className="text-sm font-bold text-slate-800">No escalations match this filter</p>
                <p className="text-xs text-slate-500 mt-1">
                  The alert engine will raise new levels automatically as deadlines pass.
                </p>
              </div>
            ) : (
              filteredEscalations.map((escalation) => (
                <div
                  key={escalation.id}
                  className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 space-y-3"
                >
                  <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-3">
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-xs font-bold text-gov-blue-900 bg-slate-100 px-2 py-0.5 rounded">
                          {escalation.applicationId}
                        </span>
                        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                          {EVENT_LABELS[escalation.eventType] || escalation.eventType}
                        </span>
                        <span className="text-[10px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-gov-saffron/15 text-amber-800 border border-amber-200">
                          Level {escalation.level}
                        </span>
                        <span
                          className={`text-[10px] font-extrabold uppercase px-1.5 py-0.5 rounded border ${STATUS_STYLES[escalation.status]}`}
                        >
                          {escalation.status}
                        </span>
                      </div>
                      <p className="text-sm text-slate-700">{escalation.reason}</p>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-500">
                        {escalation.institutionName && <span>{escalation.institutionName}</span>}
                        <span className="inline-flex items-center gap-1">
                          <MapPin className="w-3 h-3" /> {escalation.region}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <Clock className="w-3 h-3" /> Raised {formatDate(escalation.createdAt)}
                        </span>
                        <span>Owner: {escalation.recipientRole}</span>
                      </div>
                      {escalation.status === 'RESOLVED' && escalation.remarks && (
                        <p className="text-[11px] text-emerald-700 bg-emerald-50 border border-emerald-100 rounded px-2 py-1">
                          Resolution: {escalation.remarks}
                        </p>
                      )}
                    </div>

                    {escalation.status !== 'RESOLVED' && (
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {escalation.status === 'OPEN' && (
                          <button
                            type="button"
                            disabled={busyId === escalation.id}
                            onClick={() => handleAcknowledge(escalation.id)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-amber-500 text-white text-xs font-bold hover:bg-amber-600 disabled:opacity-50"
                          >
                            <Check className="w-3.5 h-3.5" /> Acknowledge
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() =>
                            setResolvingId(resolvingId === escalation.id ? null : escalation.id)
                          }
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" /> Resolve
                        </button>
                      </div>
                    )}
                  </div>

                  {resolvingId === escalation.id && escalation.status !== 'RESOLVED' && (
                    <div className="border-t border-slate-100 pt-3 flex flex-col sm:flex-row gap-2">
                      <input
                        type="text"
                        value={remarksById[escalation.id] || ''}
                        onChange={(e) =>
                          setRemarksById((prev) => ({ ...prev, [escalation.id]: e.target.value }))
                        }
                        placeholder="Resolution remarks (mandatory, written to the ledger)"
                        className="flex-1 px-3 py-2 rounded-md border border-slate-300 text-xs focus:outline-none focus:ring-2 focus:ring-gov-blue-500"
                      />
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          disabled={busyId === escalation.id}
                          onClick={() => handleResolve(escalation.id)}
                          className="px-3 py-2 rounded-md bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 disabled:opacity-50"
                        >
                          Confirm resolve
                        </button>
                        <button
                          type="button"
                          onClick={() => setResolvingId(null)}
                          className="p-2 rounded-md border border-slate-200 text-slate-500 hover:bg-slate-50"
                          aria-label="Cancel"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </>
      ) : (
        <div className="space-y-3">
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <h2 className="text-sm font-bold text-slate-800">Your reminders</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Reminders addressed to your institution. Mark them read once the required document or undertaking is submitted.
            </p>
          </div>
          {notifications.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-xl p-10 text-center text-sm text-slate-500">
              No reminders for your institution.
            </div>
          ) : (
            notifications.map((notification) => (
              <div
                key={notification.id}
                className={`bg-white rounded-xl border p-4 ${
                  notification.read ? 'border-slate-200 opacity-70' : 'border-amber-200'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-gov-blue-900 bg-slate-100 px-2 py-0.5 rounded">
                        {notification.applicationId}
                      </span>
                      <span
                        className={`text-[10px] font-extrabold uppercase px-1.5 py-0.5 rounded border ${
                          notification.type === 'OVERDUE'
                            ? 'bg-red-50 text-red-700 border-red-200'
                            : 'bg-amber-50 text-amber-800 border-amber-200'
                        }`}
                      >
                        {notification.type}
                      </span>
                    </div>
                    <p className="text-sm font-bold text-slate-800">{notification.title}</p>
                    <p className="text-xs text-slate-600">{notification.message}</p>
                    <p className="text-[11px] text-slate-400">{formatDate(notification.createdAt)}</p>
                  </div>
                  {!notification.read && (
                    <button
                      type="button"
                      onClick={() => handleMarkRead(notification.id)}
                      className="px-2.5 py-1.5 rounded-md border border-slate-200 text-[11px] font-bold text-slate-600 hover:bg-slate-50"
                    >
                      Mark read
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
