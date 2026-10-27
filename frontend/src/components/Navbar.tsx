'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { ShieldCheck, Menu, X, LogIn, LogOut } from 'lucide-react';
import { Role, AuthUser } from '../lib/types';
import {
  clearSession,
  dashboardRoleView,
  getSessionEventName,
  getStoredRole,
  getStoredUser,
} from '../lib/api';
import { NotificationBell } from './NotificationBell';

export function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const [role, setRole] = useState<Role>('institution');
  const [user, setUser] = useState<AuthUser | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  const syncSession = useCallback(() => {
    setRole(getStoredRole());
    setUser(getStoredUser());
  }, []);

  useEffect(() => {
    syncSession();

    window.addEventListener('aicte_role_changed', syncSession);
    window.addEventListener(getSessionEventName(), syncSession);
    
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    
    return () => {
      window.removeEventListener('aicte_role_changed', syncSession);
      window.removeEventListener(getSessionEventName(), syncSession);
      window.removeEventListener('scroll', handleScroll);
    };
  }, [syncSession]);

  const handleLogout = () => {
    clearSession();
    setUser(null);
    setRole('institution');
    router.push('/login');
  };

  const view = user ? dashboardRoleView(user) : null;
  const isInternal = user && view && view !== 'institution';

  // Public routes use marketing navbar style
  const publicRoutes = ['/', '/login', '/register', '/verify-email'];
  const isPublicRoute = publicRoutes.includes(pathname) || pathname?.startsWith('/verify/');

  // No public nav links shown

  if (!isPublicRoute && user) {
    // For logged-in non-public routes, we might still show minimal nav or rely on AppShell
    // But the prompt says "Public routes keep the marketing navbar and footer"
    // "AppShell layout for logged-in routes" - so maybe still show navbar or let layout handle
  }

  if (isPublicRoute && !user) {
    return (
      <header className={`fixed top-0 left-0 right-0 z-50 transition-all duration-200 ${
        scrolled 
          ? 'pt-4' 
          : 'pt-0'
      }`}>
        <div className={`mx-auto transition-all duration-200 ${
          scrolled
            ? 'max-w-6xl px-4'
            : 'max-w-7xl px-4 sm:px-6 lg:px-8'
        }`}>
          <div className={`flex items-center justify-between transition-all duration-200 ${
            scrolled
              ? 'bg-white/95 backdrop-blur-md rounded-2xl border border-line shadow-float px-6 h-14'
              : 'bg-transparent h-16'
          }`}>
            {/* Logo */}
            <Link href="/" className="flex items-center gap-2 group">
              <div className="w-8 h-8 rounded-lg bg-brand-600/10 flex items-center justify-center">
                <ShieldCheck className="w-5 h-5 text-brand-600" />
              </div>
              <span className="font-bold text-lg text-ink-900">Vishwas</span>
            </Link>



            {/* Right side */}
            <div className="flex items-center gap-2">
              <Link
                href="/login"
                className="hidden sm:inline-flex px-4 py-2 text-sm text-ink-600 hover:text-ink-900 transition-colors"
              >
                Log in
              </Link>
              <Link
                href="/register"
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium rounded-lg transition-colors"
              >
                <span>Register</span>
              </Link>
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                type="button"
                className="lg:hidden p-2 rounded-lg text-ink-600 hover:bg-canvas"
                aria-label="Toggle navigation menu"
              >
                {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="lg:hidden mx-4 mt-2 bg-white rounded-2xl border border-line shadow-float p-4 space-y-1">
            <Link
              href="/login"
              onClick={() => setMobileMenuOpen(false)}
              className="block px-3 py-2 text-sm text-ink-600 hover:text-ink-900 hover:bg-canvas rounded-lg"
            >
              Log in
            </Link>
            <Link
              href="/register"
              onClick={() => setMobileMenuOpen(false)}
              className="block px-3 py-2 text-sm bg-brand-600 text-white rounded-lg text-center"
            >
              Register
            </Link>
          </div>
        )}
      </header>
    );
  }

  // For logged-in users on non-public routes or other cases - simplified navbar
  return (
    <header className="bg-white border-b border-line sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-brand-600/10 flex items-center justify-center">
              <ShieldCheck className="w-5 h-5 text-brand-600" />
            </div>
            <span className="font-bold text-lg text-ink-900">Vishwas</span>
          </Link>

          <div className="flex items-center gap-3">
            {user && <NotificationBell />}
            {user ? (
              <div className="flex items-center gap-2">
                <div className="hidden md:block text-right">
                  <div className="text-xs font-medium text-ink-900 truncate max-w-[150px]">
                    {user.institutionName || user.name}
                  </div>
                  <div className="text-[10px] text-ink-400 uppercase">
                    {user.role}
                  </div>
                </div>
                <button
                  onClick={handleLogout}
                  type="button"
                  className="p-2 rounded-lg text-ink-600 hover:bg-canvas transition-colors"
                  aria-label="Sign out"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <Link
                href="/login"
                className="px-4 py-2 text-sm text-ink-600 hover:text-ink-900"
              >
                Log in
              </Link>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
