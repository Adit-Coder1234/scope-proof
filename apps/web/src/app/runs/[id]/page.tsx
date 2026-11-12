"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import { fetchRun } from "@/lib/api";
import {
  ArrowLeft,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock,
  ShieldAlert,
  PhoneCall,
  User,
  Bot,
  ExternalLink
} from "lucide-react";

export default function RunReportPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const [run, setRun] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadRun();
  }, [resolvedParams.id]);

  async function loadRun() {
    setLoading(true);
    try {
      const data = await fetchRun(resolvedParams.id);
      setRun(data);
    } catch (err) {
      console.error("Error loading run:", err);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-slate-400">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500 mr-3"></div>
        Loading quality run report...
      </div>
    );
  }

  if (!run) {
    return (
      <div className="space-y-4">
        <Link href="/runs" className="inline-flex items-center gap-1 text-sm text-indigo-400 hover:underline">
          <ArrowLeft className="w-4 h-4" /> Back to Runs
        </Link>
        <div className="p-6 bg-slate-900 border border-slate-800 rounded-xl text-slate-300">
          Run not found.
        </div>
      </div>
    );
  }

  const passPct = run.passRate !== null ? Math.round(run.passRate * 100) : null;
  const calls = run.calls || [];
  const allTurns = calls.flatMap((c: any) => c.turns || []);
  const passedTurns = allTurns.filter((t: any) => t.gate === "PASS").length;
  const reviewTurns = allTurns.filter((t: any) => t.gate === "REVIEW").length;
  const fallbackTurns = allTurns.filter((t: any) => t.gate === "FALLBACK").length;

  return (
    <div className="space-y-8">
      {/* Top Breadcrumb & Header */}
      <div className="space-y-4">
        <Link href="/runs" className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-400 hover:text-indigo-300 transition">
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Runs List
        </Link>

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900/70 border border-slate-800 p-6 rounded-2xl shadow-xl backdrop-blur-md">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-black text-white">
                Run Report #{run.id.slice(-8)}
              </h1>
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                Scope v{run.scope?.version || 1}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Evaluated with Model: <code className="text-slate-200">{run.model}</code> &bull; Started:{" "}
              {new Date(run.startedAt).toLocaleString()}
            </p>
          </div>

          <div className="flex items-center gap-4">
            <div className="text-right">
              <span className="block text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Scope Pass Rate
              </span>
              <span
                className={`text-2xl font-black ${
                  passPct === null
                    ? "text-slate-400"
                    : passPct >= 80
                    ? "text-emerald-400"
                    : passPct >= 60
                    ? "text-amber-400"
                    : "text-rose-400"
                }`}
              >
                {passPct !== null ? `${passPct}%` : "N/A"}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Metrics Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 bg-slate-900/60 border border-slate-800 rounded-xl space-y-1">
          <span className="text-xs text-slate-400 font-medium">Total Test Calls</span>
          <p className="text-2xl font-black text-white">{calls.length}</p>
        </div>
        <div className="p-4 bg-slate-900/60 border border-slate-800 rounded-xl space-y-1">
          <span className="text-xs text-slate-400 font-medium flex items-center gap-1 text-emerald-400">
            <CheckCircle2 className="w-3.5 h-3.5" /> Passed Turns
          </span>
          <p className="text-2xl font-black text-emerald-300">{passedTurns}</p>
        </div>
        <div className="p-4 bg-slate-900/60 border border-slate-800 rounded-xl space-y-1">
          <span className="text-xs text-slate-400 font-medium flex items-center gap-1 text-amber-400">
            <AlertTriangle className="w-3.5 h-3.5" /> Held For Review
          </span>
          <p className="text-2xl font-black text-amber-300">{reviewTurns}</p>
        </div>
        <div className="p-4 bg-slate-900/60 border border-slate-800 rounded-xl space-y-1">
          <span className="text-xs text-slate-400 font-medium flex items-center gap-1 text-rose-400">
            <XCircle className="w-3.5 h-3.5" /> Fallbacks Triggered
          </span>
          <p className="text-2xl font-black text-rose-300">{fallbackTurns}</p>
        </div>
      </div>

      {/* Calls & Turn Level Detail (Task 5.2) */}
      <div className="space-y-6">
        <h2 className="text-lg font-bold text-white flex items-center gap-2">
          <PhoneCall className="w-5 h-5 text-indigo-400" />
          Call Executions & Gate Verdicts ({calls.length})
        </h2>

        {calls.map((call: any, cIdx: number) => (
          <div
            key={call.id}
            className="bg-slate-900/70 border border-slate-800 rounded-2xl overflow-hidden shadow-xl"
          >
            {/* Call Header */}
            <div className="bg-slate-950/80 px-6 py-4 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3">
              <div>
                <span className="text-xs font-mono font-bold text-indigo-300 mr-3">
                  Call #{cIdx + 1} ({call.id.slice(-8)})
                </span>
                <span className="text-xs text-slate-400 mr-3">
                  Room: <code className="text-slate-300 font-mono">{call.livekitRoom}</code>
                </span>
                <span className="text-xs text-slate-400">
                  Carrier: <strong className="text-slate-200">{call.carrier}</strong>
                </span>
              </div>

              <div className="flex items-center gap-2">
                {call.latencyP50Ms && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-500/10 text-indigo-300 border border-indigo-500/30">
                    <Clock className="w-3 h-3" /> p50: {call.latencyP50Ms}ms
                  </span>
                )}
                <Link
                  href={`/live?callId=${call.id}`}
                  className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 transition"
                >
                  Live View <ExternalLink className="w-3 h-3" />
                </Link>
              </div>
            </div>

            {/* Turns in this call */}
            <div className="p-6 space-y-4">
              {call.turns?.length === 0 ? (
                <p className="text-sm text-slate-400 italic">No turns recorded for this call.</p>
              ) : (
                call.turns.map((turn: any) => (
                  <div
                    key={turn.id}
                    className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-5 space-y-4"
                  >
                    {/* Turn Meta Row */}
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800/80 pb-3">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                          Turn #{turn.idx}
                        </span>
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                            turn.gate === "PASS"
                              ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                              : turn.gate === "REVIEW"
                              ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                              : "bg-rose-500/20 text-rose-300 border border-rose-500/30"
                          }`}
                        >
                          GATE: {turn.gate}
                        </span>
                        {turn.judgeScore !== null && (
                          <span className="text-xs px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-mono">
                            Judge: {(turn.judgeScore * 100).toFixed(0)}%
                          </span>
                        )}
                      </div>

                      {/* Latency & Flag Pills */}
                      <div className="flex flex-wrap items-center gap-1.5">
                        {turn.flags?.map((flag: string, fIdx: number) => (
                          <span
                            key={fIdx}
                            className={`px-2 py-0.5 rounded text-[10px] font-mono font-semibold ${
                              flag.includes("ms:")
                                ? "bg-indigo-950/60 text-indigo-300 border border-indigo-800/40"
                                : "bg-rose-950/60 text-rose-300 border border-rose-800/40"
                            }`}
                          >
                            {flag}
                          </span>
                        ))}

                        {turn.reviewItem && (
                          <Link
                            href="/reviews"
                            className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 hover:bg-amber-500/30 transition flex items-center gap-1"
                          >
                            Review Queue ({turn.reviewItem.status})
                          </Link>
                        )}
                      </div>
                    </div>

                    {/* Dialogue Comparison: Caller vs Proposed vs Spoken */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                      <div className="p-3 rounded-lg bg-slate-900/90 border border-slate-800 space-y-1">
                        <span className="font-bold text-slate-400 flex items-center gap-1.5 uppercase tracking-wider text-[10px]">
                          <User className="w-3 h-3 text-slate-400" /> Caller Utterance
                        </span>
                        <p className="text-slate-200 text-sm font-medium">{turn.callerText}</p>
                      </div>

                      <div className="p-3 rounded-lg bg-indigo-950/30 border border-indigo-900/40 space-y-1">
                        <span className="font-bold text-indigo-400 flex items-center gap-1.5 uppercase tracking-wider text-[10px]">
                          <Bot className="w-3 h-3 text-indigo-400" /> Spoken by Agent
                        </span>
                        <p className="text-indigo-100 text-sm font-medium">{turn.spoken}</p>
                      </div>
                    </div>

                    {/* Proposed vs Gate Intervention (if blocked) */}
                    {turn.gate !== "PASS" && turn.proposed?.proposed_utterance !== turn.spoken && (
                      <div className="p-3 rounded-lg bg-rose-950/20 border border-rose-900/40 space-y-1">
                        <span className="font-bold text-rose-400 uppercase tracking-wider text-[10px] flex items-center gap-1">
                          <ShieldAlert className="w-3.5 h-3.5" /> Blocked Utterance (Never Spoken to Caller)
                        </span>
                        <p className="text-xs text-rose-200 font-mono">
                          {turn.proposed?.proposed_utterance}
                        </p>
                      </div>
                    )}

                    {/* Judge Reason */}
                    {turn.judgeReason && (
                      <div className="text-xs text-slate-400 italic bg-slate-900/40 p-2.5 rounded-lg border border-slate-800/50">
                        <strong className="text-slate-300 not-italic">Judge Verdict: </strong>
                        {turn.judgeReason}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

