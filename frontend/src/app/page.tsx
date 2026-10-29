'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { ArrowRight, ShieldCheck, CheckCircle2, Zap, Bell, FileText, Users, BarChart3, Calendar, AlertTriangle, Terminal } from 'lucide-react';
import { Eyebrow } from '../components/ui/Eyebrow';
import { SectionHeading } from '../components/ui/SectionHeading';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { GradientBorderCard } from '../components/ui/GradientBorderCard';
import { StatCard } from '../components/ui/StatCard';
import { NetworkCard } from '../components/ui/NetworkCard';
import { DarkSection } from '../components/ui/DarkSection';
import { TerminalCard } from '../components/ui/TerminalCard';
import { BentoCard } from '../components/ui/BentoCard';
import { clearSession } from '../lib/api';

const rotatingTexts = ['region', 'officers', 'institutions'];

export default function HomePage() {
  const [currentTextIndex, setCurrentTextIndex] = useState(0);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    clearSession();
  }, []);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(mediaQuery.matches);
    
    if (!mediaQuery.matches) {
      const interval = setInterval(() => {
        setCurrentTextIndex((prev) => (prev + 1) % rotatingTexts.length);
      }, 3000);
      return () => clearInterval(interval);
    }
  }, []);

  return (
    <div className="pt-16">
      {/* Hero Section */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-white via-brand-50/30 to-purple-50/30"></div>
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-12 pb-20">
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-50 border border-brand-600/20 text-xs font-medium text-brand-700 mb-6">
              <span className="w-1.5 h-1.5 rounded-full bg-brand-600 animate-pulse"></span>
              ● PROTOTYPE · SMART INDIA HACKATHON 2026
            </div>
            
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-ink-900 tracking-tight leading-tight mb-6">
              Approve institutions{' '}
              <span className="text-brand-600 relative">
                effortlessly
                {!prefersReducedMotion && (
                  <span className="absolute -right-4 top-0 animate-pulse">|</span>
                )}
              </span>
              .
            </h1>
            
            <p className="text-lg sm:text-xl text-ink-600 mb-4">
              Zero delays for your{' '}
              <span className="text-ink-900 font-medium inline-block transition-opacity duration-500">
                {rotatingTexts[currentTextIndex]}
              </span>
            </p>
            
            <p className="text-base text-ink-600 max-w-2xl mx-auto mb-8 leading-relaxed">
              AICTE approval-workflow and compliance-monitoring platform with time-bound scrutiny, 
              role-based workflows, and cryptographic audit trails.
            </p>
            
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-12">
              <Link href="/register">
                <Button size="lg" showArrow>
                  Get Started
                </Button>
              </Link>
              <Link href="#demo">
                <Button variant="secondary" size="lg">
                  View Demo
                </Button>
              </Link>
            </div>
            
            {/* Stats Row */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-8 mb-12 max-w-4xl mx-auto">
              <StatCard value="4" label="approval routes" />
              <StatCard value="5" label="role views" />
              <StatCard value="SHA-256" label="audit ledger" />
              <StatCard value="30/15/7/1" label="day alerts" />
            </div>
          </div>
          
          {/* Product Preview Card */}
          <div className="max-w-5xl mx-auto">
            <GradientBorderCard>
              <div className="p-6 sm:p-8">
                <div className="flex items-center gap-2 mb-6">
                  <div className="w-3 h-3 rounded-full bg-red-400"></div>
                  <div className="w-3 h-3 rounded-full bg-yellow-400"></div>
                  <div className="w-3 h-3 rounded-full bg-green-400"></div>
                  <span className="text-xs text-ink-400 ml-2">vishwas-dashboard</span>
                </div>
                <div className="bg-canvas rounded-xl p-4 sm:p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-semibold text-ink-900">Pendency Dashboard</h3>
                    <span className="text-xs px-2 py-1 bg-brand-50 text-brand-700 rounded-full">Mock Preview</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 mb-4">
                    <div className="bg-white p-3 rounded-lg border border-line">
                      <div className="text-lg font-bold text-ink-900">12</div>
                      <div className="text-xs text-ink-400">Pending</div>
                    </div>
                    <div className="bg-white p-3 rounded-lg border border-line">
                      <div className="text-lg font-bold text-warning">5</div>
                      <div className="text-xs text-ink-400">Approaching</div>
                    </div>
                    <div className="bg-white p-3 rounded-lg border border-line">
                      <div className="text-lg font-bold text-danger">3</div>
                      <div className="text-xs text-ink-400">Overdue</div>
                    </div>
                    <div className="bg-white p-3 rounded-lg border border-line">
                      <div className="text-lg font-bold text-teal">2</div>
                      <div className="text-xs text-ink-400">Delayed EVC</div>
                    </div>
                  </div>
                  <div className="bg-white rounded-lg border border-line overflow-hidden">
                    <div className="px-3 py-2 bg-canvas border-b border-line text-xs font-medium text-ink-600">
                      Pending Cases
                    </div>
                    <div className="divide-y divide-line">
                      {[
                        { id: 'APP-2026-045', inst: 'Tech Institute Delhi', stage: 'Scrutiny', age: '12 days', status: 'Approaching' },
                        { id: 'APP-2026-032', inst: 'Engineering College Pune', stage: 'EVC', age: '18 days', status: 'Overdue' },
                        { id: 'APP-2026-028', inst: 'Management Institute', stage: 'Document Check', age: '8 days', status: 'On time' },
                      ].map((item, idx) => (
                        <div key={idx} className="px-3 py-2 flex items-center justify-between text-xs">
                          <div>
                            <div className="font-medium text-ink-900">{item.id}</div>
                            <div className="text-ink-400">{item.inst}</div>
                          </div>
                          <div className="text-ink-600">{item.stage}</div>
                          <div className="text-ink-600">{item.age}</div>
                          <span className={`px-2 py-0.5 rounded-full text-xs ${
                            item.status === 'Overdue' ? 'bg-red-50 text-danger' :
                            item.status === 'Approaching' ? 'bg-amber-50 text-warning' :
                            'bg-green-50 text-success'
                          }`}>
                            {item.status}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </GradientBorderCard>
          </div>
        </div>
      </section>

      {/* Delays strip */}
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <Eyebrow className="block mb-2">REACTIVE CHECKS ARE DEAD</Eyebrow>
            <h2 className="text-2xl sm:text-3xl font-bold text-ink-900">Delays? No approval.</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              { icon: <Zap className="w-6 h-6 text-brand-600" />, title: 'Continuous expiry monitoring', desc: 'Track document validity and renewals automatically' },
              { icon: <FileText className="w-6 h-6 text-brand-600" />, title: 'Automatic stage movement', desc: 'Return-with-reasons workflow with clear audit trail' },
              { icon: <Bell className="w-6 h-6 text-brand-600" />, title: 'Instant alerts and escalation', desc: '30/15/7/1-day alerts to keep cases moving' },
            ].map((item, idx) => (
              <div key={idx} className="text-center">
                <div className="w-12 h-12 rounded-full bg-brand-50 flex items-center justify-center mx-auto mb-4">
                  {item.icon}
                </div>
                <h3 className="font-semibold text-ink-900 mb-2">{item.title}</h3>
                <p className="text-sm text-ink-600">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Dark showcase */}
      <DarkSection>
        <div className="text-center mb-10">
          <span className="text-xs text-slate-400 uppercase tracking-wider">APPROVAL OPERATIONS</span>
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-white mt-2 mb-4">
            Your Approval Operations Assistant
          </h2>
          <div className="flex flex-wrap items-center justify-center gap-2 mb-8">
            {['Routing Engine', 'Pendency Monitor', 'Alert Engine', 'Audit Ledger'].map((tab, idx) => (
              <button
                key={idx}
                className={`px-4 py-2 rounded-full text-sm transition-colors ${
                  idx === 0 ? 'bg-brand-600 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          <TerminalCard title="sample output">
            <div>[ALERT] APP-2026-045 approaching SLA - 3 days remaining</div>
            <div>[ESCALATE] APP-2026-032 overdue - escalated to Bureau Officer</div>
            <div>[LEDGER] Decision recorded - hash: a3f7...9b2e verified</div>
            <div>[ROUTE] EVC scheduled - inspection team assigned</div>
            <div className="text-slate-500">_</div>
          </TerminalCard>
          <div className="grid grid-cols-1 gap-4">
            {[
              { value: '37', label: 'alerts, 0 duplicates' },
              { value: '4', label: 'routes' },
              { value: 'Hash-chained', label: 'ledger' },
            ].map((item, idx) => (
              <div key={idx} className={`p-6 rounded-xl ${idx === 1 ? 'bg-brand-600' : 'bg-slate-800'}`}>
                <div className="text-2xl sm:text-3xl font-bold text-white mb-1">{item.value}</div>
                <div className="text-sm text-slate-400">{item.label}</div>
              </div>
            ))}
          </div>
        </div>
      </DarkSection>

      {/* Features Bento */}
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <SectionHeading 
            eyebrow="FEATURES" 
            title="Everything you need for approval workflows"
            subtitle="Comprehensive tools for institutions, officers, and committees"
            centered
          />
          <div className="bg-brand-50/50 rounded-3xl p-6 sm:p-8">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[
                { icon: <Zap className="w-5 h-5 text-brand-600" />, title: 'Workflow Automation', desc: 'Deterministic stage transitions with validation rules' },
                { icon: <BarChart3 className="w-5 h-5 text-brand-600" />, title: 'Pendency Dashboards', desc: 'Real-time visibility across all approval routes' },
                { icon: <Calendar className="w-5 h-5 text-brand-600" />, title: 'EVC Scheduling', desc: 'Expert visit committee management and tracking' },
                { icon: <FileText className="w-5 h-5 text-brand-600" />, title: 'Time-bound Undertakings', desc: 'Track compliance with deadline monitoring' },
                { icon: <ShieldCheck className="w-5 h-5 text-brand-600" />, title: 'Document Validity & Renewals', desc: 'Automated expiry alerts and tracking' },
                { icon: <Users className="w-5 h-5 text-brand-600" />, title: 'Role-based Access', desc: 'Granular permissions by role and region' },
                { icon: <Bell className="w-5 h-5 text-brand-600" />, title: 'Notifications & Escalation', desc: 'Multi-tier alerts with automatic escalation' },
                { icon: <FileText className="w-5 h-5 text-brand-600" />, title: 'Reports & CSV Export', desc: 'Comprehensive reporting and data export' },
              ].map((feature, idx) => (
                <BentoCard key={idx} icon={feature.icon} title={feature.title} description={feature.desc} />
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Steps section */}
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <Eyebrow className="block mb-2">HOW IT WORKS</Eyebrow>
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-ink-900">
              Move from application to approval in four simple steps
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <NetworkCard color="green" title="Apply & upload">
              Institutions submit applications with required documents
            </NetworkCard>
            <NetworkCard color="indigo" title="Scrutiny & sign-off">
              Regional/bureau officers review and validate
            </NetworkCard>
            <NetworkCard color="teal" title="Expert visit (EVC)">
              Committee conducts physical and digital verification
            </NetworkCard>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { num: '1', title: 'Apply & upload' },
              { num: '2', title: 'Scrutiny & sign-off' },
              { num: '3', title: 'Expert visit (EVC)' },
              { num: '4', title: 'Decision & ledger record' },
            ].map((step, idx) => (
              <div key={idx} className="flex items-center gap-3 p-4 bg-canvas rounded-xl border border-line">
                <div className="w-8 h-8 rounded-full bg-brand-600 text-white flex items-center justify-center font-semibold text-sm">
                  {step.num}
                </div>
                <span className="font-medium text-ink-900 text-sm">{step.title}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Roles */}
      <section className="py-16 bg-canvas">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <SectionHeading 
            title="Built for every stakeholder"
            subtitle="Role-based views tailored to specific responsibilities"
            centered
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            {[
              { role: 'Institution', desc: 'Submit applications and track status' },
              { role: 'Regional Officer', desc: 'Scrutinize applications in region' },
              { role: 'Bureau Officer', desc: 'Review and process cases' },
              { role: 'Committee', desc: 'Conduct inspections and evaluations' },
              { role: 'Head Office', desc: 'Oversee and make final decisions' },
            ].map((item, idx) => (
              <Card key={idx} padding="sm">
                <div className="text-center">
                  <div className="w-10 h-10 rounded-full bg-brand-50 flex items-center justify-center mx-auto mb-2">
                    <Users className="w-5 h-5 text-brand-600" />
                  </div>
                  <h3 className="font-semibold text-ink-900 text-sm mb-1">{item.role}</h3>
                  <p className="text-xs text-ink-600">{item.desc}</p>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Safeguard band */}
      <section className="py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-brand-50 border border-brand-600/20 rounded-xl p-6 flex items-start gap-3">
            <ShieldCheck className="w-5 h-5 text-brand-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm text-ink-900 font-medium mb-1">Statutory Safeguard</p>
              <p className="text-sm text-ink-600">
                Automated alerts, recommendations and workflow actions in Vishwas support the approval process. 
                They do not replace statutory scrutiny, verification, inspections or decisions that belong to the competent authority.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-16 bg-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-ink-900 mb-4">
            Ready to streamline approvals?
          </h2>
          <p className="text-lg text-ink-600 mb-8">
            Join the modern approach to AICTE approval workflows
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link href="/register">
              <Button size="lg" showArrow>
                Get Started
              </Button>
            </Link>
            <Link href="/login">
              <Button variant="secondary" size="lg">
                Sign In
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
