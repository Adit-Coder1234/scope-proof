"use client";

import { useEffect, useState, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { fetchCall, fetchRuns } from "@/lib/api";
import {
  Mic,
  Radio,
  Clock,
  ShieldAlert,
  User,
  Bot,
  Volume2
} from "lucide-react";

function LiveTranscriptContent() {
  const searchParams = useSearchParams();
  const initialCallId = searchParams.get("callId");

  const [calls, setCalls] = useState<any[]>([]);
  const [selectedCallId, setSelectedCallId] = useState<string>(initialCallId || "");
  const [callData, setCallData] = useState<any | null>(null);
  const [isLiveStreaming, setIsLiveStreaming] = useState(true);

  const userInteractedRef = useRef(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Poll available calls so new calls show up in real-time
  useEffect(() => {
    let active = true;

    async function loadRecentCalls() {
      try {
        const runs = await fetchRuns();
        const availableCalls: any[] = [];
        runs.forEach((r: any) => {
          (r.calls || []).forEach((c: any) => {
            availableCalls.push({
              id: c.id,
              room: c.livekitRoom,
              carrier: c.carrier,
              time: r.startedAt,
              p50: c.latencyP50Ms
            });
          });
        });

        if (active) {
          setCalls(availableCalls);
          if (availableCalls.length > 0) {
            // Auto-select latest call if none is selected, or if user hasn't manually pinned an older call
            if (!initialCallId && !userInteractedRef.current) {
              setSelectedCallId(availableCalls[0].id);
            } else if (!selectedCallId) {
              setSelectedCallId(availableCalls[0].id);
            }
          }
        }
      } catch (err) {
        console.error("Error loading calls:", err);
      }
    }

    loadRecentCalls();
    let pollInterval: NodeJS.Timeout | null = null;
    if (isLiveStreaming) {
      pollInterval = setInterval(loadRecentCalls, 2500);
    }

    return () => {
      active = false;
      if (pollInterval) clearInterval(pollInterval);
    };
  }, [initialCallId, isLiveStreaming, selectedCallId]);

  // Polling / streaming turns
  useEffect(() => {
    if (!selectedCallId) return;

    let active = true;

    async function streamCall() {
      try {
        const data = await fetchCall(selectedCallId);
        if (active) {
          setCallData(data);
          // Auto-scroll to bottom of transcript
          if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
          }
        }
      } catch (err) {
        console.error("Error fetching call transcript:", err);
      }
    }

    streamCall();

    let interval: NodeJS.Timeout | null = null;
    if (isLiveStreaming) {
      interval = setInterval(streamCall, 1800);
    }

    return () => {
      active = false;
      if (interval) clearInterval(interval);
    };
  }, [selectedCallId, isLiveStreaming]);

  const turns = callData?.turns || [];

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900/70 border border-slate-800 p-6 rounded-2xl shadow-xl backdrop-blur-md">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-black text-white flex items-center gap-3">
              <Radio className="w-7 h-7 text-emerald-400" />
              Live Call Transcript & Voice Monitor
            </h1>
            <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-ping"></span>
              LIVE WebRTC
            </span>
          </div>
          <p className="text-sm text-slate-400 mt-1">
            Real-time streaming transcript showing turns as they are verified and spoken by the LiveKit agent.
          </p>
        </div>

        {/* Call Selector & Controls */}
        <div className="flex flex-wrap items-center gap-3">
          <select
            value={selectedCallId}
            onChange={(e) => {
              userInteractedRef.current = true;
              setSelectedCallId(e.target.value);
            }}
            className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500 font-mono"
          >
            {calls.map((c) => (
              <option key={c.id} value={c.id}>
                Call #{c.id.slice(-6)} &bull; {c.room}
              </option>
            ))}
          </select>

          <button
            onClick={() => setIsLiveStreaming(!isLiveStreaming)}
            className={`px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition ${
              isLiveStreaming
                ? "bg-emerald-600 hover:bg-emerald-500 text-white"
                : "bg-slate-800 hover:bg-slate-700 text-slate-300"
            }`}
          >
            {isLiveStreaming ? "Streaming Active" : "Stream Paused"}
          </button>
        </div>
      </div>

      {/* Main Transcript Card */}
      <div className="bg-slate-900/60 border border-slate-800/90 rounded-2xl overflow-hidden shadow-2xl flex flex-col h-[650px]">
        {/* Call Meta Bar */}
        <div className="bg-slate-950/80 px-6 py-3 border-b border-slate-800 flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center gap-4">
            <span>
              LiveKit Room: <strong className="text-slate-200 font-mono">{callData?.livekitRoom || "None"}</strong>
            </span>
            <span>
              Carrier: <strong className="text-slate-200">{callData?.carrier || "TELNYX / WebRTC"}</strong>
            </span>
            {callData?.latencyP50Ms && (
              <span className="text-indigo-400 font-semibold flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" /> p50 Latency: {callData.latencyP50Ms}ms
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-rose-500 animate-pulse"></span>
            <span className="font-semibold text-slate-300">Recording Audio Stream</span>
          </div>
        </div>

        {/* Scrollable Conversation Stream */}
        <div ref={scrollRef} className="flex-1 p-6 overflow-y-auto space-y-6">
          {turns.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-slate-500 space-y-2">
              <Mic className="w-10 h-10 opacity-40 animate-pulse text-indigo-400" />
              <p className="text-sm">Waiting for incoming audio stream in room...</p>
            </div>
          ) : (
            turns.map((turn: any) => (
              <div key={turn.id} className="space-y-4">
                {/* Caller Message (Left) */}
                <div className="flex items-start gap-3 max-w-[80%]">
                  <div className="h-8 w-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-300 shrink-0">
                    <User className="w-4 h-4" />
                  </div>
                  <div className="bg-slate-800/90 border border-slate-700/80 rounded-2xl rounded-tl-sm p-4 space-y-1 shadow-md">
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                        Caller &bull; Turn #{turn.idx}
                      </span>
                      <span className="text-[10px] text-slate-500 font-mono">
                        {new Date(turn.createdAt).toLocaleTimeString()}
                      </span>
                    </div>
                    <p className="text-sm text-slate-100 font-medium">{turn.callerText}</p>
                  </div>
                </div>

                {/* Agent Response (Right) */}
                <div className="flex items-start justify-end gap-3 ml-auto max-w-[85%]">
                  <div className="bg-indigo-950/70 border border-indigo-800/60 rounded-2xl rounded-tr-sm p-4 space-y-2.5 shadow-lg text-right">
                    <div className="flex items-center justify-end gap-3">
                      {/* Gate Outcome Badge */}
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          turn.gate === "PASS"
                            ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                            : turn.gate === "REVIEW"
                            ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                            : "bg-rose-500/20 text-rose-300 border border-rose-500/40"
                        }`}
                      >
                        GATE: {turn.gate}
                      </span>

                      {/* Latency Metrics */}
                      {turn.flags
                        ?.filter((f: string) => f.includes("ms:"))
                        .map((f: string, i: number) => (
                          <span
                            key={i}
                            className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-indigo-900/60 text-indigo-300 border border-indigo-700/40"
                          >
                            {f}
                          </span>
                        ))}

                      <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider flex items-center gap-1">
                        <Volume2 className="w-3.5 h-3.5" /> Agent Spoken
                      </span>
                    </div>

                    <p className="text-sm text-indigo-100 font-medium text-left leading-relaxed">
                      {turn.spoken}
                    </p>

                    {/* Blocked Utterance Notice if Gate Intervened */}
                    {turn.gate !== "PASS" && turn.proposed?.proposed_utterance !== turn.spoken && (
                      <div className="bg-rose-950/40 border border-rose-800/50 p-2.5 rounded-xl text-left space-y-1">
                        <span className="text-[10px] font-bold text-rose-400 uppercase tracking-wider flex items-center gap-1">
                          <ShieldAlert className="w-3 h-3" /> Blocked Risky Utterance:
                        </span>
                        <p className="text-xs text-rose-200 font-mono">
                          {turn.proposed?.proposed_utterance}
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="h-8 w-8 rounded-full bg-gradient-to-tr from-indigo-600 to-indigo-400 flex items-center justify-center text-white shrink-0 shadow-md shadow-indigo-500/20">
                    <Bot className="w-4 h-4" />
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

export default function LiveTranscriptPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center py-20 text-slate-400">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500 mr-3"></div>
          Loading live transcript monitor...
        </div>
      }
    >
      <LiveTranscriptContent />
    </Suspense>
  );
}

