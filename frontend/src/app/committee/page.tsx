'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Users,
  Calendar,
  MapPin,
  CheckCircle2,
  ShieldAlert,
  Clock,
  ArrowRight,
  ShieldCheck,
  Building,
} from 'lucide-react';
import { Application } from '../../lib/types';
import { getApplications } from '../../lib/api';
import { StatusBadge } from '../../components/StatusBadge';
import { DemoBanner } from '../../components/DemoBanner';
import { formatDate } from '../../lib/utils';

interface CommitteeTask {
  applicationId: string;
  institutionName: string;
  visitDate: string;
  leadExpert: string;
  campusCity: string;
  inspectionType: string;
  status: string;
  checklist: { item: string; status: 'VERIFIED' | 'PENDING' | 'ACTION_REQUIRED' }[];
}

export default function CommitteePage() {
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDemo, setIsDemo] = useState(false);

  useEffect(() => {
    getApplications().then((res) => {
      setApplications(res.data || []);
      setIsDemo(res.isDemo);
      setLoading(false);
    });
  }, []);

  // Filter or augment applications that require or completed EVC visits
  const evcApplications = applications.filter((a) =>
    ['EVC_REQUIRED', 'EVC_DONE', 'DECISION', 'APPROVED'].includes(a.status)
  );

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <DemoBanner show={isDemo} />

      {/* Header bar */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-purple-700">
            <Users className="w-5 h-5 text-purple-700" />
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
              Expert Visit Committee (EVC) Inspections
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-slate-600 mt-1">
            Assigned physical campus reviews & compliance checks (Read-only view for peer evaluators).
          </p>
        </div>

        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-purple-50 border border-purple-200 text-purple-800 text-xs font-semibold self-start sm:self-auto">
          <span>Read-Only Portal</span>
        </div>
      </div>

      {/* Cards Grid */}
      <div className="space-y-4">
        <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wider">
          Assigned Inspections ({evcApplications.length})
        </h2>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[1, 2].map((i) => (
              <div key={i} className="h-48 bg-slate-100 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : evcApplications.length === 0 ? (
          <div className="bg-white p-12 text-center rounded-xl border border-slate-200 text-slate-500">
            No campus inspections currently assigned in EVC queue.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {evcApplications.map((app) => (
              <div
                key={app.id}
                className="bg-white rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-all p-6 flex flex-col justify-between space-y-4"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-bold text-gov-blue-800 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                      {app.id}
                    </span>
                    <StatusBadge status={app.status} size="sm" />
                  </div>

                  <div>
                    <h3 className="font-bold text-base text-slate-900">{app.institutionName}</h3>
                    <p className="text-xs text-slate-500 mt-0.5 uppercase tracking-wide">
                      {app.type.replace(/_/g, ' ')}
                    </p>
                  </div>

                  {/* Inspection details strip */}
                  <div className="grid grid-cols-2 gap-2 text-xs text-slate-600 bg-slate-50 p-3 rounded-lg border border-slate-100">
                    <div className="flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-slate-400" />
                      <span>Submitted: {formatDate(app.createdAt)}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Building className="w-3.5 h-3.5 text-slate-400" />
                      <span>
                        Land: {app.extracted?.landAreaSqm?.toLocaleString() || '10,000+'} sq.m
                      </span>
                    </div>
                  </div>

                  {/* Checklist overview */}
                  <div className="space-y-1.5 pt-1">
                    <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">
                      Mandatory Physical Norms Checklist
                    </span>
                    <div className="space-y-1 text-xs">
                      <div className="flex items-center justify-between p-2 rounded bg-emerald-50/60 text-emerald-900 border border-emerald-100">
                        <span>Contiguous Land Possession & Boundary Wall</span>
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      </div>
                      <div className="flex items-center justify-between p-2 rounded bg-emerald-50/60 text-emerald-900 border border-emerald-100">
                        <span>Fire Hydrant, Extinguishers & NOC Compliance</span>
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      </div>
                      <div className="flex items-center justify-between p-2 rounded bg-slate-50 text-slate-700 border border-slate-200">
                        <span>Barrier-Free Built Environment / Ramp Access</span>
                        <Clock className="w-4 h-4 text-slate-400" />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-[11px] text-slate-400">
                    // TODO(next): OR-Tools conflict-of-interest scheduler
                  </span>
                  <Link
                    href={`/verify/${app.id}`}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-gov-blue-800 hover:text-gov-blue-900"
                  >
                    <span>Audit Trail</span>
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
