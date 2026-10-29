import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Navbar } from '../components/Navbar';
import { MailModeBanner } from '../components/MailModeBanner';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Vishwas | AICTE Approval System',
  description:
    'AICTE approval-workflow and compliance-monitoring platform. Automated scrutiny, strict state transitions, and cryptographic ledger verification.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning className={inter.className}>
      <body className="bg-canvas text-ink-900 flex flex-col min-h-screen" suppressHydrationWarning>
        <Navbar />
        <MailModeBanner />
        <main className="flex-1 w-full">{children}</main>
        <footer className="bg-white border-t border-line text-xs py-10 mt-16 relative overflow-hidden">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 md:grid-cols-12 gap-8 mb-8">
              <div className="md:col-span-4">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-8 h-8 rounded-lg bg-brand-600/10 flex items-center justify-center">
                    <svg className="w-5 h-5 text-brand-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                    </svg>
                  </div>
                  <span className="font-bold text-base text-ink-900">Vishwas</span>
                </div>
                <p className="text-xs text-ink-600 mb-4 max-w-xs">
                  AICTE approval-workflow and compliance-monitoring platform for time-bound scrutiny and transparent decisions.
                </p>
                <div className="flex flex-wrap gap-2">
                  <div className="flex items-center gap-2 px-2 py-1 rounded-lg border border-line bg-canvas">
                    <div className="w-6 h-6 rounded-full bg-accent text-white flex items-center justify-center text-[10px] font-semibold">
                      AC
                    </div>
                    <div className="text-[11px]">
                      <div className="font-medium text-ink-900">AICTE</div>
                      <div className="text-ink-400">Partner</div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="md:col-span-2">
                <h4 className="text-[11px] font-semibold uppercase tracking-wider text-ink-400 mb-3">PRODUCT</h4>
                <ul className="space-y-2">
                  <li><a href="/" className="text-ink-600 hover:text-ink-900 transition-colors">Home</a></li>
                  <li><a href="/dashboard" className="text-ink-600 hover:text-ink-900 transition-colors">Dashboard</a></li>
                  <li><a href="/audit" className="text-ink-600 hover:text-ink-900 transition-colors">Audit Trail</a></li>
                  <li><a href="/reports" className="text-ink-600 hover:text-ink-900 transition-colors">Reports</a></li>
                </ul>
              </div>
              <div className="md:col-span-2">
                <h4 className="text-[11px] font-semibold uppercase tracking-wider text-ink-400 mb-3">RESOURCES</h4>
                <ul className="space-y-2">
                  <li><a href="#" className="text-ink-600 hover:text-ink-900 transition-colors">Documentation</a></li>
                  <li><a href="#" className="text-ink-600 hover:text-ink-900 transition-colors">API Reference</a></li>
                  <li><a href="#" className="text-ink-600 hover:text-ink-900 transition-colors">Guidelines</a></li>
                  <li><a href="#" className="text-ink-600 hover:text-ink-900 transition-colors">FAQs</a></li>
                </ul>
              </div>
              <div className="md:col-span-2">
                <h4 className="text-[11px] font-semibold uppercase tracking-wider text-ink-400 mb-3">DEVELOPERS</h4>
                <ul className="space-y-2">
                  <li><a href="#" className="text-ink-600 hover:text-ink-900 transition-colors">GitHub</a></li>
                  <li><a href="/verify" className="text-ink-600 hover:text-ink-900 transition-colors">Verify Hash</a></li>
                  <li><a href="#" className="text-ink-600 hover:text-ink-900 transition-colors">Changelog</a></li>
                  <li><a href="#" className="text-ink-600 hover:text-ink-900 transition-colors">Status</a></li>
                </ul>
              </div>
              <div className="md:col-span-2">
                <h4 className="text-[11px] font-semibold uppercase tracking-wider text-ink-400 mb-3">COMPANY</h4>
                <ul className="space-y-2">
                  <li><a href="#" className="text-ink-600 hover:text-ink-900 transition-colors">About</a></li>
                  <li><a href="#" className="text-ink-600 hover:text-ink-900 transition-colors">Privacy</a></li>
                  <li><a href="#" className="text-ink-600 hover:text-ink-900 transition-colors">Terms</a></li>
                  <li><a href="#" className="text-ink-600 hover:text-ink-900 transition-colors">Contact</a></li>
                </ul>
              </div>
            </div>
            <div className="pt-6 border-t border-line flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="text-[11px] text-ink-400">
                <p>Government of India · AICTE</p>
                <p>© 2026 Vishwas. Prototype: timelines are placeholders pending the Approval Process Handbook.</p>
              </div>
              <div className="text-[11px] text-ink-400">
                Cryptographic Audit Hash Chain Engine v1.0
              </div>
            </div>
          </div>
          <div className="absolute bottom-0 left-0 right-0 overflow-hidden pointer-events-none">
            <div className="text-[120px] md:text-[200px] font-bold text-ink-400/5 leading-none select-none translate-y-1/2">
              VISHWAS
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
