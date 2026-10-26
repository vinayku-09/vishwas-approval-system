'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ShieldCheck, UserCheck, Menu, X, Landmark } from 'lucide-react';
import { Role } from '../lib/types';
import { getStoredRole, setStoredRole } from '../lib/api';
import { NotificationBell } from './NotificationBell';

export function Navbar() {
  const pathname = usePathname();
  const [role, setRole] = useState<Role>('institution');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    setRole(getStoredRole());

    const handleRoleChange = () => {
      setRole(getStoredRole());
    };

    window.addEventListener('aicte_role_changed', handleRoleChange);
    return () => window.removeEventListener('aicte_role_changed', handleRoleChange);
  }, []);

  const handleRoleSelect = (newRole: Role) => {
    setStoredRole(newRole);
    setRole(newRole);
  };

  const navLinks = [
    { href: '/', label: 'Overview' },
    { href: '/institution', label: 'Institution Portal' },
    { href: '/officer', label: 'Officer Queue' },
    { href: '/committee', label: 'Committee Inspections' },
    { href: '/alerts', label: 'Alerts & Escalations' },
  ];

  return (
    <header className="bg-gov-blue-900 text-white border-b-4 border-gov-saffron shadow-md sticky top-0 z-50">
      {/* Top micro-bar for Government Emblem / National Context */}
      <div className="bg-gov-blue-950/70 border-b border-white/10 px-4 py-1 text-[11px] text-slate-300">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-white tracking-wide">भारत सरकार | Government of India</span>
            <span className="text-slate-400">|</span>
            <span className="hidden sm:inline">Ministry of Education</span>
          </div>
          <div className="flex items-center gap-2 font-mono text-[10px] text-gov-gold">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>AICTE Tamper-Proof Audit Active</span>
          </div>
        </div>
      </div>

      {/* Main Navbar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Title */}
          <Link href="/" className="flex items-center gap-3 group">
            <div className="w-10 h-10 rounded-lg bg-white/10 border border-white/20 flex items-center justify-center text-gov-gold group-hover:bg-white/20 transition-all">
              <Landmark className="w-6 h-6 text-amber-400" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-extrabold text-lg sm:text-xl tracking-tight text-white">AICTE</span>
                <span className="text-xs font-semibold px-1.5 py-0.5 rounded bg-gov-saffron text-white uppercase tracking-wider">
                  Smart Approval
                </span>
              </div>
              <p className="text-[11px] text-blue-200 hidden sm:block">
                All India Council for Technical Education
              </p>
            </div>
          </Link>

          {/* Desktop Navigation Links */}
          <nav className="hidden md:flex items-center space-x-1">
            {navLinks.map((link) => {
              const isActive = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`px-3.5 py-2 rounded-md text-xs sm:text-sm font-medium transition-all ${
                    isActive
                      ? 'bg-white/20 text-white font-semibold shadow-inner'
                      : 'text-blue-100 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>

          {/* Role Switcher & Notifications */}
          <div className="flex items-center gap-3">
            <NotificationBell />

            <div className="bg-gov-blue-950/80 border border-white/20 rounded-lg p-1 flex items-center gap-1 text-xs">
              <span className="text-[10px] uppercase font-bold text-blue-300 px-2 hidden lg:inline">
                Active Role:
              </span>
              {(['institution', 'officer', 'committee', 'chief'] as Role[]).map((r) => {
                const isSelected = role === r;
                return (
                  <button
                    key={r}
                    onClick={() => handleRoleSelect(r)}
                    type="button"
                    className={`px-2.5 py-1 rounded text-xs font-semibold capitalize transition-all ${
                      isSelected
                        ? 'bg-gov-saffron text-white shadow-sm'
                        : 'text-blue-200 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    {r}
                  </button>
                );
              })}
            </div>

            {/* Mobile menu trigger */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              type="button"
              className="md:hidden p-2 rounded-md text-white hover:bg-white/10"
              aria-label="Toggle navigation menu"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Drawer Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-gov-blue-950 border-t border-white/10 px-4 pt-2 pb-4 space-y-1">
          {navLinks.map((link) => {
            const isActive = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMobileMenuOpen(false)}
                className={`block px-3 py-2 rounded-md text-sm font-medium ${
                  isActive ? 'bg-white/20 text-white font-bold' : 'text-blue-200 hover:bg-white/10'
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </div>
      )}
    </header>
  );
}
