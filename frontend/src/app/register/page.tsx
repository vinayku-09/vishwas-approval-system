'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Building2,
  Mail,
  Phone,
  PhoneCall,
  MapPin,
  Lock,
  ArrowRight,
  Loader2,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  KeyRound,
  RotateCcw,
} from 'lucide-react';
import { requestRegistrationOtp, registerInstitution } from '../../lib/api';
import { INDIAN_STATES } from '../../config/states';

export default function RegisterPage() {
  const router = useRouter();

  // Form inputs
  const [collegeName, setCollegeName] = useState('');
  const [email, setEmail] = useState('');
  const [mobile, setMobile] = useState('');
  const [telephone, setTelephone] = useState('');
  const [state, setState] = useState(INDIAN_STATES[0]);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [otp, setOtp] = useState('');

  // Workflow state
  const [otpSent, setOtpSent] = useState(false);
  const [otpNotice, setOtpNotice] = useState<string | null>(null);
  const [cooldownSeconds, setCooldownSeconds] = useState(0);
  const [sendingOtp, setSendingOtp] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [registeredSuccess, setRegisteredSuccess] = useState(false);

  // Cooldown countdown effect
  useEffect(() => {
    if (cooldownSeconds <= 0) return;
    const timer = setInterval(() => {
      setCooldownSeconds((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldownSeconds]);

  const handleSendOtp = async (e?: React.MouseEvent) => {
    if (e) e.preventDefault();
    setError(null);
    setOtpNotice(null);

    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail) {
      setError('Please provide your official institutional email first.');
      return;
    }

    setSendingOtp(true);
    const res = await requestRegistrationOtp(trimmedEmail);
    setSendingOtp(false);

    if (res.error) {
      setError(res.error);
      return;
    }

    setOtpSent(true);
    setCooldownSeconds(60);
    setOtpNotice(
      res.message ||
        'If the email address is valid, a 6-digit verification code has been dispatched to your official inbox.'
    );
  };

  const handleRegister = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);

    // Client-side validation
    if (!collegeName.trim()) {
      setError('College name is required.');
      return;
    }
    if (!email.trim()) {
      setError('Official email is required.');
      return;
    }
    if (!mobile.trim()) {
      setError('Mobile number is required.');
      return;
    }
    if (!telephone.trim()) {
      setError('Telephone number is required.');
      return;
    }
    if (!state) {
      setError('State selection is required.');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters long.');
      return;
    }
    if (password.toLowerCase() === email.trim().toLowerCase()) {
      setError('Password cannot be identical to your email address.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    if (!otpSent) {
      setError('Please request a 6-digit verification OTP first.');
      return;
    }
    if (!otp.trim() || otp.trim().length !== 6) {
      setError('Please enter the 6-digit numeric OTP sent to your email.');
      return;
    }

    setSubmitting(true);
    const res = await registerInstitution({
      collegeName: collegeName.trim(),
      email: email.trim().toLowerCase(),
      mobile: mobile.trim(),
      telephone: telephone.trim(),
      state,
      password,
      confirmPassword,
      otp: otp.trim(),
    });
    setSubmitting(false);

    if (res.error) {
      setError(res.error);
      return;
    }

    setRegisteredSuccess(true);
  };

  return (
    <div className="min-h-[calc(100vh-8rem)] bg-slate-100 px-4 py-10 sm:py-14">
      <div className="max-w-4xl mx-auto grid grid-cols-1 lg:grid-cols-[1.05fr_0.95fr] gap-6">
        {/* Left Information Banner */}
        <section className="bg-gov-blue-900 text-white rounded-2xl p-6 sm:p-8 shadow-xl border-b-4 border-gov-saffron flex flex-col justify-between">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 border border-white/20 text-[11px] font-bold text-gov-gold uppercase tracking-wider">
              <ShieldCheck className="w-3.5 h-3.5" />
              AICTE National Portal
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold mt-5">
              Technical Institute Registration
            </h1>
            <p className="text-sm text-blue-100 mt-3 leading-relaxed">
              Create your verified institutional profile to initiate approval applications, Extension of Approval (EoA), and institutional compliance filings under AICTE statutory regulations.
            </p>

            <div className="mt-8 space-y-4">
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-white/10 text-gov-gold">
                  <KeyRound className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold">Email Two-Factor Authentication</h3>
                  <p className="text-xs text-blue-200 mt-0.5">
                    A secure 6-digit OTP is dispatched via Nodemailer. OTP expires in 10 minutes, allows up to 5 attempts, and enforces a 60-second cooldown.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-white/10 text-gov-gold">
                  <MapPin className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold">Deterministic Regional Mapping</h3>
                  <p className="text-xs text-blue-200 mt-0.5">
                    Your state maps directly to your governing AICTE Regional Office (Northern, Western, Southern, Central, etc.) via statutory jurisdiction rules.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-white/10 text-gov-gold">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold">Immutable Ledger Audit</h3>
                  <p className="text-xs text-blue-200 mt-0.5">
                    Upon OTP verification, your registration is permanently committed to the SHA-256 audit ledger (IDs only; zero credentials logged).
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-8 pt-6 border-t border-white/15 text-xs text-blue-200">
            Already registered?{' '}
            <Link href="/login" className="font-bold text-gov-gold hover:underline">
              Sign in to portal
            </Link>
          </div>
        </section>

        {/* Right Registration Form */}
        <section className="bg-white rounded-2xl p-6 sm:p-8 shadow-md border border-slate-200 flex flex-col justify-center">
          {registeredSuccess ? (
            <div className="text-center py-6">
              <div className="w-16 h-16 mx-auto rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center">
                <CheckCircle2 className="w-10 h-10" />
              </div>
              <h2 className="text-2xl font-bold text-slate-900 mt-4">
                Registration Complete
              </h2>
              <p className="text-sm text-slate-600 mt-2 leading-relaxed">
                Your institution account has been verified and registered. An audit record has been published to the AICTE ledger.
              </p>
              <div className="mt-6">
                <Link
                  href="/login"
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-gov-blue-900 hover:bg-gov-blue-800 text-white text-sm font-bold transition-colors"
                >
                  Proceed to Login <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </div>
          ) : (
            <div>
              <div className="flex items-center gap-2.5 mb-5 pb-3 border-b border-slate-100">
                <Building2 className="w-5 h-5 text-gov-blue-800" />
                <h2 className="text-lg font-bold text-slate-900">Institution Registration</h2>
              </div>

              {error && (
                <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-800 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              {otpNotice && (
                <div className="mb-4 rounded-lg border border-blue-200 bg-blue-50 p-3 text-xs text-blue-800 flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                  <span>{otpNotice}</span>
                </div>
              )}

              <form onSubmit={handleRegister} className="space-y-3.5">
                {/* College Name */}
                <label className="block">
                  <span className="text-xs font-semibold text-slate-700">College Name *</span>
                  <div className="mt-1 relative">
                    <Building2 className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      required
                      value={collegeName}
                      onChange={(e) => setCollegeName(e.target.value)}
                      placeholder="e.g. National Institute of Technology"
                      className="w-full rounded-lg border border-slate-300 pl-9 pr-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-gov-blue-700/30 focus:border-gov-blue-700"
                    />
                  </div>
                </label>

                {/* Email with Send OTP button */}
                <label className="block">
                  <span className="text-xs font-semibold text-slate-700">Official Email *</span>
                  <div className="mt-1 flex gap-2">
                    <div className="relative flex-1">
                      <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="registrar@college.edu.in"
                        className="w-full rounded-lg border border-slate-300 pl-9 pr-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-gov-blue-700/30 focus:border-gov-blue-700"
                      />
                    </div>
                    <button
                      type="button"
                      disabled={sendingOtp || cooldownSeconds > 0}
                      onClick={handleSendOtp}
                      className="px-3 py-2 rounded-lg bg-gov-blue-900 hover:bg-gov-blue-800 text-white text-xs font-semibold transition-colors disabled:opacity-60 shrink-0 flex items-center gap-1.5"
                    >
                      {sendingOtp ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>Sending...</span>
                        </>
                      ) : cooldownSeconds > 0 ? (
                        <>
                          <RotateCcw className="w-3.5 h-3.5" />
                          <span>{cooldownSeconds}s</span>
                        </>
                      ) : (
                        <span>{otpSent ? 'Resend OTP' : 'Send OTP'}</span>
                      )}
                    </button>
                  </div>
                </label>

                {/* OTP Verification Code (visible or highlighted once sent) */}
                {otpSent && (
                  <label className="block bg-amber-50/70 border border-amber-200 p-3 rounded-lg">
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-bold text-amber-900">
                        6-Digit Verification Code (OTP) *
                      </span>
                      <span className="text-[10px] text-amber-700">Valid for 10 min</span>
                    </div>
                    <div className="mt-1 relative">
                      <KeyRound className="w-4 h-4 text-amber-600 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        maxLength={6}
                        required
                        value={otp}
                        onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                        placeholder="123456"
                        className="w-full tracking-widest font-mono text-center rounded-lg border border-amber-300 pl-9 pr-3 py-2 text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500 bg-white"
                      />
                    </div>
                  </label>
                )}

                {/* Mobile & Telephone in 2 columns */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <label className="block">
                    <span className="text-xs font-semibold text-slate-700">Mobile Number *</span>
                    <div className="mt-1 relative">
                      <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="tel"
                        required
                        value={mobile}
                        onChange={(e) => setMobile(e.target.value)}
                        placeholder="9876543210"
                        className="w-full rounded-lg border border-slate-300 pl-9 pr-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-gov-blue-700/30 focus:border-gov-blue-700"
                      />
                    </div>
                  </label>

                  <label className="block">
                    <span className="text-xs font-semibold text-slate-700">Telephone *</span>
                    <div className="mt-1 relative">
                      <PhoneCall className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="tel"
                        required
                        value={telephone}
                        onChange={(e) => setTelephone(e.target.value)}
                        placeholder="011-23456789"
                        className="w-full rounded-lg border border-slate-300 pl-9 pr-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-gov-blue-700/30 focus:border-gov-blue-700"
                      />
                    </div>
                  </label>
                </div>

                {/* State Dropdown */}
                <label className="block">
                  <span className="text-xs font-semibold text-slate-700">State *</span>
                  <div className="mt-1 relative">
                    <MapPin className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <select
                      value={state}
                      onChange={(e) => setState(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 pl-9 pr-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-gov-blue-700/30 focus:border-gov-blue-700 bg-white"
                    >
                      {INDIAN_STATES.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </div>
                </label>

                {/* Password & Confirm Password */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <label className="block">
                    <span className="text-xs font-semibold text-slate-700">Password (min 8 chars) *</span>
                    <div className="mt-1 relative">
                      <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="password"
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full rounded-lg border border-slate-300 pl-9 pr-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-gov-blue-700/30 focus:border-gov-blue-700"
                      />
                    </div>
                  </label>

                  <label className="block">
                    <span className="text-xs font-semibold text-slate-700">Confirm Password *</span>
                    <div className="mt-1 relative">
                      <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="password"
                        required
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full rounded-lg border border-slate-300 pl-9 pr-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-gov-blue-700/30 focus:border-gov-blue-700"
                      />
                    </div>
                  </label>
                </div>

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full mt-2 inline-flex items-center justify-center gap-2 rounded-lg bg-gov-saffron hover:bg-orange-600 text-white text-xs font-bold px-4 py-2.5 transition-colors disabled:opacity-60 shadow-sm"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Verifying & Registering...
                    </>
                  ) : (
                    <>
                      Verify OTP & Register
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
