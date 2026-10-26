import type { Metadata } from 'next';
import './globals.css';
import { Navbar } from '../components/Navbar';
import { MailModeBanner } from '../components/MailModeBanner';

export const metadata: Metadata = {
  title: 'AICTE Approval System | National Automation Portal',
  description:
    'Automated AICTE Technical Institution Approval Workflow with Rule Scrutiny, Strict State Transitions, and Cryptographic Ledger Verification.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-slate-50 text-slate-900 flex flex-col min-h-screen">
        <Navbar />
        <MailModeBanner />
        <main className="flex-1 w-full">{children}</main>
        <footer className="bg-gov-blue-950 text-slate-400 border-t border-slate-800 text-xs py-6 mt-12">
          <div className="max-w-7xl mx-auto px-4 flex flex-col md:flex-row items-center justify-between gap-4">
            <div>
              <p className="font-semibold text-slate-200">
                All India Council for Technical Education (AICTE)
              </p>
              <p className="text-[11px] text-slate-400">
                Statutory body under Department of Higher Education, Ministry of Education, Govt. of India.
              </p>
            </div>
            <div className="text-right text-[11px]">
              <p>Cryptographic Audit Hash Chain Engine v1.0</p>
              <p className="text-slate-500">Built for Smart India Hackathon / AICTE Automation Starter</p>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
