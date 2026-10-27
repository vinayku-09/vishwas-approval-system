'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowRight,
  ClipboardCheck,
  Landmark,
  Loader2,
  Lock,
  Mail,
  ShieldCheck,
  Users,
  UserCheck,
  Building2,
  ChevronDown,
} from 'lucide-react';
import {
  clearSession,
  dashboardHomePath,
  DEMO_ACCOUNTS,
  getStoredUser,
  login,
  loginAsDemoRole,
} from '../../lib/api';
import { AuthUser, UserRole } from '../../lib/types';

type DemoRole = keyof typeof DEMO_ACCOUNTS;

const ROLE_ICONS: Record<DemoRole, React.ComponentType<{ className?: string }>> = {
  officer: ClipboardCheck,
  committee: Users,
  chief: UserCheck,
};

const ROLE_OPTIONS: Array<{ value: UserRole; label: string; description: string }> = [
  { value: 'INSTITUTION', label: 'Technical Institution', description: 'Colleges, Polytechnics, Universities' },
  { value: 'OFFICER', label: 'Scrutiny Officer', description: 'Regional AICTE Scrutiny Officers' },
  { value: 'COMMITTEE', label: 'Expert Committee', description: 'EVC / Inspection / Appellate Members' },
  { value: 'CHIEF', label: 'AICTE Chief / Council Head', description: 'Executive Leadership & National Bureau' },
];

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<UserRole>('INSTITUTION');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [nextPath, setNextPath] = useState<string | null>(null);

  useEffect(() => {
    setCurrentUser(getStoredUser());
    const params = new URLSearchParams(window.location.search);
    if (params.get('expired') === '1') {
      setNotice('Your session expired. Please sign in again.');
    }
    const next = params.get('next');
    if (next && next.startsWith('/') && !next.startsWith('//')) {
      setNextPath(next);
    }
  }, []);

  const demoAccounts = useMemo(
    () =>
      (Object.entries(DEMO_ACCOUNTS) as Array<[DemoRole, (typeof DEMO_ACCOUNTS)[DemoRole]]>).map(
        ([key, account]) => ({ key, ...account })
      ),
    []
  );

  const goAfterLogin = (user: AuthUser) => {
    if (nextPath) {
      router.push(nextPath);
      return;
    }
    router.push(dashboardHomePath(user));
  };

  const authenticate = async (
    credentials: { email: string; password: string; role?: UserRole },
    demoRole?: DemoRole
  ) => {
    setSubmitting(true);
    setError(null);
    const result = demoRole
      ? await loginAsDemoRole(demoRole)
      : await login(credentials);
    setSubmitting(false);

    if (!result.data) {
      setError(result.error || 'Invalid email, password, or role selection');
      return;
    }

    goAfterLogin(result.data.user);
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!email.trim() || !password) {
      setError('Email and password are required.');
      return;
    }
    await authenticate({ email: email.trim(), password, role });
  };

  const handleDemoLogin = async (demoKey: DemoRole) => {
    const account = DEMO_ACCOUNTS[demoKey];
    const targetRole = demoKey.toUpperCase() as UserRole;
    setEmail(account.email);
    setPassword(account.password);
    setRole(targetRole);
    await authenticate({ email: account.email, password: account.password, role: targetRole }, demoKey);
  };

  const handleSignOut = () => {
    clearSession();
    setCurrentUser(null);
    setNotice('Signed out.');
  };

  return (
    <div className="min-h-[calc(100vh-8rem)] bg-slate-100 px-4 py-10 sm:py-14">
      <div className="max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-[1.05fr_0.95fr] gap-6">
        <section className="bg-gov-blue-900 text-white rounded-2xl p-6 sm:p-8 shadow-xl border-b-4 border-gov-saffron">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 border border-white/20 text-[11px] font-bold text-gov-gold uppercase tracking-wider">
            <ShieldCheck className="w-3.5 h-3.5" />
            Authenticated Access
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold mt-5">
            Sign in to the AICTE Approval Portal
          </h1>
          <p className="text-sm text-blue-100 mt-3 leading-relaxed">
            Your session is issued as a signed eight-hour JWT. Role, region and
            institution scope are strictly validated for every protected request.
          </p>

          {currentUser && (
            <div className="mt-6 rounded-xl bg-emerald-500/10 border border-emerald-400/30 p-4">
              <p className="text-xs text-emerald-200 font-semibold uppercase tracking-wide">
                Currently signed in
              </p>
              <p className="text-sm font-bold mt-1">{currentUser.name}</p>
              <p className="text-xs text-blue-100">
                {currentUser.email} · {currentUser.role}
                {currentUser.region ? ` · ${currentUser.region}` : ''}
              </p>
              <div className="flex flex-wrap gap-2 mt-3">
                <button
                  type="button"
                  onClick={() => router.push(dashboardHomePath(currentUser))}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-xs font-bold text-white"
                >
                  Continue <ArrowRight className="w-3 h-3" />
                </button>
                <button
                  type="button"
                  onClick={handleSignOut}
                  className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 border border-white/20 text-xs font-semibold"
                >
                  Sign out
                </button>
              </div>
            </div>
          )}

          <div className="mt-8">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-amber-300">
              <Landmark className="w-4 h-4" />
              Seeded demo accounts
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-3">
              {demoAccounts.map((account) => {
                const Icon = ROLE_ICONS[account.key];
                return (
                  <button
                    key={account.key}
                    type="button"
                    disabled={submitting}
                    onClick={() => handleDemoLogin(account.key)}
                    className="flex items-start gap-2.5 p-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/15 text-left transition-colors disabled:opacity-60"
                  >
                    <Icon className="w-4 h-4 text-gov-gold mt-0.5 flex-shrink-0" />
                    <span className="min-w-0">
                      <span className="block text-xs font-bold text-white">
                        {account.label}
                      </span>
                      <span className="block text-[10px] text-blue-200 truncate">
                        {account.email}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
            <p className="text-[11px] text-blue-200 mt-3">
              Password for seeded demo accounts: <code>Password123!</code>
            </p>
          </div>
        </section>

        <section className="bg-white rounded-2xl p-6 sm:p-8 shadow-xl border border-slate-200">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">Secure login</h2>
              <p className="text-xs text-slate-500">JWT session · Role Verification</p>
            </div>
          </div>

          {notice && (
            <div className="mt-5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
              {notice}
            </div>
          )}
          {error && (
            <div className="mt-5 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            {/* Role Dropdown */}
            <label className="block">
              <span className="text-xs font-bold text-slate-700">Account Role *</span>
              <div className="mt-1 relative">
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as UserRole)}
                  className="w-full appearance-none rounded-lg border border-slate-300 pl-3 pr-8 py-2.5 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-gov-blue-700/30 focus:border-gov-blue-700 bg-white font-medium"
                >
                  {ROLE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label} — {opt.description}
                    </option>
                  ))}
                </select>
                <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
              <p className="text-[10px] text-slate-500 mt-1">
                Role is cryptographically validated against account records on login.
              </p>
            </label>

            {/* Email address */}
            <label className="block">
              <span className="text-xs font-bold text-slate-700">Email address *</span>
              <div className="mt-1 relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="e.g. registrar@college.edu.in"
                  className="w-full rounded-lg border border-slate-300 pl-9 pr-3 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-gov-blue-700/30 focus:border-gov-blue-700"
                  required
                />
              </div>
            </label>

            {/* Password */}
            <label className="block">
              <span className="text-xs font-bold text-slate-700">Password *</span>
              <div className="mt-1 relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="••••••••"
                  className="w-full rounded-lg border border-slate-300 pl-9 pr-3 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-gov-blue-700/30 focus:border-gov-blue-700"
                  required
                />
              </div>
            </label>

            <button
              type="submit"
              disabled={submitting}
              className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-gov-blue-900 hover:bg-gov-blue-800 text-white text-sm font-bold px-4 py-3 transition-colors disabled:opacity-60"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Authenticating...
                </>
              ) : (
                <>
                  Sign in
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          <div className="mt-6 pt-5 border-t border-slate-200 text-center">
            <p className="text-xs text-slate-600">
              New Institution?{' '}
              <Link
                href="/register"
                className="font-bold text-gov-blue-800 hover:text-gov-blue-900 underline"
              >
                Register your institution
              </Link>
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
