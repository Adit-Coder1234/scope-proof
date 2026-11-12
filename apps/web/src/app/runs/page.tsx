"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { fetchRuns } from "@/lib/api";
import {
  Activity,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ArrowRight,
  PhoneCall,
  Calendar,
  Cpu
} from "lucide-react";

export default function RunsListPage() {
  const [runs, setRuns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadRuns();
  }, []);

  async function loadRuns() {
    setLoading(true);
    try {
      const data = await fetchRuns();
      setRuns(data);
    } catch (err) {
      console.error("Error loading runs:", err);
    } finally {
      setLoading(false);
    }
  }

  const getPassRateBadge = (passRate: number | null) => {
    if (passRate === null || passRate === undefined) {
      return (
        <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-800 text-slate-400 border border-slate-700">
          IN PROGRESS
        </span>
      );
    }
    const pct = Math.round(passRate * 100);
    if (pct >= 85) {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
          <CheckCircle2 className="w-3.5 h-3.5" /> {pct}% PASS
        </span>
      );
    }
    if (pct >= 60) {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
          <AlertTriangle className="w-3.5 h-3.5" /> {pct}% MIXED
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30">
        <XCircle className="w-3.5 h-3.5" /> {pct}% BREACH
      </span>
    );
  };

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900/70 border border-slate-800 p-6 rounded-2xl shadow-xl backdrop-blur-md">
        <div>
          <h1 className="text-2xl font-black text-white flex items-center gap-3">
            <Activity className="w-7 h-7 text-indigo-400" />
            Test Runs & Quality Reports
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Automated test call runs evaluating scope enforcement, hallucination boundaries, and latency.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={loadRuns}
            className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition"
          >
            Refresh Runs
          </button>
        </div>
      </div>

      {/* Runs Table */}
      <div className="bg-slate-900/60 border border-slate-800/90 rounded-2xl overflow-hidden shadow-xl">
        {loading ? (
          <div className="flex items-center justify-center py-20 text-slate-400">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500 mr-3"></div>
            Loading test runs...
          </div>
        ) : runs.length === 0 ? (
          <div className="p-12 text-center text-slate-400">
            No test runs recorded yet. Run a call in the Live Simulator or run the test harness.
          </div>
        ) : (
          <div className="divide-y divide-slate-800">
            {runs.map((run: any) => (
              <div
                key={run.id}
                className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-slate-800/40 transition"
              >
                <div className="space-y-1.5">
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-sm font-bold text-white">
                      Run #{run.id.slice(-8)}
                    </span>
                    {getPassRateBadge(run.passRate)}
                    <span className="text-xs px-2 py-0.5 rounded bg-indigo-950 text-indigo-300 border border-indigo-800/50 font-medium">
                      Scope v{run.scope?.version || 1}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-400">
                    <span className="flex items-center gap-1">
                      <Cpu className="w-3.5 h-3.5 text-slate-500" />
                      Model: <code className="text-slate-300">{run.model}</code>
                    </span>
                    <span className="flex items-center gap-1">
                      <PhoneCall className="w-3.5 h-3.5 text-slate-500" />
                      Calls: <strong className="text-slate-200">{run._count?.calls ?? run.calls?.length ?? 0}</strong>
                    </span>
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5 text-slate-500" />
                      {new Date(run.startedAt).toLocaleString()}
                    </span>
                  </div>
                </div>

                <div>
                  <Link
                    href={`/runs/${run.id}`}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-indigo-600/80 hover:bg-indigo-600 text-white shadow-md shadow-indigo-600/20 transition"
                  >
                    View Report <ArrowRight className="w-3.5 h-3.5" />
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

