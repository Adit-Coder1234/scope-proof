import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "ScopeProof — The written scope, executed.",
  description: "Voice-agent quality layer that validates agreed client scopes against live voice calls."
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="antialiased text-slate-100 flex flex-col min-h-screen">
        {/* Top Navigation Bar */}
        <header className="border-b border-indigo-900/40 bg-slate-950/80 backdrop-blur-md sticky top-0 z-50 px-6 py-3.5 flex items-center justify-between shadow-lg">
          <div className="flex items-center space-x-8">
            <Link href="/" className="flex items-center space-x-3">
              <div className="h-9 w-9 rounded-lg bg-gradient-to-tr from-indigo-600 via-indigo-500 to-emerald-400 flex items-center justify-center font-bold text-lg text-white shadow-md shadow-indigo-500/20">
                SP
              </div>
              <div>
                <span className="font-extrabold text-xl tracking-tight bg-gradient-to-r from-white via-indigo-100 to-indigo-300 bg-clip-text text-transparent">
                  ScopeProof
                </span>
                <span className="block text-[10px] text-slate-400 uppercase tracking-widest font-semibold">
                  Voice Quality Layer
                </span>
              </div>
            </Link>

            <nav className="hidden md:flex items-center space-x-1 text-sm font-medium">
              <Link
                href="/"
                className="px-3.5 py-2 rounded-md hover:bg-slate-800/80 text-slate-200 hover:text-white transition-colors"
              >
                Scopes & Rules
              </Link>
              <Link
                href="/runs"
                className="px-3.5 py-2 rounded-md hover:bg-slate-800/80 text-slate-200 hover:text-white transition-colors"
              >
                Test Runs & Reports
              </Link>
              <Link
                href="/reviews"
                className="px-3.5 py-2 rounded-md hover:bg-slate-800/80 text-slate-200 hover:text-white transition-colors flex items-center gap-1.5"
              >
                Review Queue
                <span className="px-1.5 py-0.5 text-[11px] font-bold rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  Live
                </span>
              </Link>
              <Link
                href="/live"
                className="px-3.5 py-2 rounded-md hover:bg-slate-800/80 text-slate-200 hover:text-white transition-colors flex items-center gap-1.5"
              >
                Live Transcript
                <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse"></span>
              </Link>
            </nav>
          </div>

          <div className="flex items-center space-x-3 text-xs">
            {/* Carrier Status Pills */}
            <div className="hidden lg:flex items-center gap-2 border border-slate-800 bg-slate-900/60 rounded-full px-3 py-1">
              <span className="h-2 w-2 rounded-full bg-indigo-400"></span>
              <span className="text-slate-400 font-medium">LiveKit Cloud:</span>
              <span className="text-slate-200 font-semibold">WebRTC Active</span>
            </div>

            <div className="hidden lg:flex items-center gap-2 border border-slate-800 bg-slate-900/60 rounded-full px-3 py-1">
              <span className="h-2 w-2 rounded-full bg-emerald-400"></span>
              <span className="text-slate-400 font-medium">Twilio Inbound:</span>
              <span className="text-emerald-300 font-mono font-semibold">+1-737-250-8034</span>
            </div>

            <div className="border border-indigo-500/30 bg-indigo-950/40 rounded-full px-3 py-1 text-indigo-300 font-medium">
              Apex Staffing Agency (MOCK)
            </div>
          </div>
        </header>

        {/* Page Main Content */}
        <main className="flex-1 max-w-7xl w-full mx-auto p-6 md:p-8">
          {children}
        </main>

        <footer className="border-t border-slate-800/60 py-4 text-center text-xs text-slate-500">
          ScopeProof &copy; 2026 &mdash; The written scope, executed. Groq LLM Brain &bull; LiveKit WebRTC &bull; PostgreSQL
        </footer>
      </body>
    </html>
  );
}

