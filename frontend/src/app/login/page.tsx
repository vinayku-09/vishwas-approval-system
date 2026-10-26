'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowRight,
  Building2,
  ClipboardCheck,
  Landmark,
  Loader2,
  Lock,
  Mail,
  ShieldCheck,
  Users,
  UserCheck,
} from 'lucide-react';
import {
  clearSession,
  dashboardHomePath,
  DEMO_ACCOUNTS,
  getStoredUser,
  login,
  loginAsDemoRole,
} from '../../lib/api';
import { AuthUser } from '../../lib/types';

type DemoRole = keyof typeof DEMO_ACCOUNTS;

const ROLE_ICONS: Record<DemoRole, React.ComponentType<{ className?: string }>> = {
  institution: Building2,
  officer: ClipboardCheck,
  committee: Users,
  chief: UserCheck,
};

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
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
    credentials: { email: string; password: string },
    demoRole?: DemoRole
  ) => {
    setSubmitting(true);
    setError(null);
    const result = demoRole
      ? await loginAsDemoRole(demoRole)
      : await login(credentials);
    setSubmitting(false);

    if (!result.data) {
      setError(result.error || 'Unable to sign in.');
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
    await authenticate({ email: email.trim(), password });
  };

  const handleDemoLogin = async (role: DemoRole) => {
    const account = DEMO_ACCOUNTS[role];
    setEmail(account.email);
    setPassword(account.password);
    await authenticate({ email: account.email, password: account.password }, role);
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
            institution scope are enforced by the API for every protected
            request.
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
              Password for every seeded account: <code>Password123!</code>
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
              <p className="text-xs text-slate-500">JWT session · 8 hour expiry</p>
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
            <label className="block">
              <span className="text-xs font-bold text-slate-700">Email address</span>
              <div className="mt-1 relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="officer@aicte.gov.in"
                  className="w-full rounded-lg border border-slate-300 pl-9 pr-3 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-gov-blue-700/30 focus:border-gov-blue-700"
                  required
                />
              </div>
            </label>

            <label className="block">
              <span className="text-xs font-bold text-slate-700">Password</span>
              <div className="mt-1 relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Password123!"
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
                  Signing in...
                </>
              ) : (
                <>
                  Sign in
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          <div className="mt-5 rounded-xl bg-slate-50 border border-slate-200 p-3 text-[11px] text-slate-600 leading-relaxed">
            If the API is offline, the portal can still be explored using local
            seed data. The amber demo banner will remain visible until a live
            backend request succeeds.
          </div>
        </section>
      </div>
    </div>
  );
}
