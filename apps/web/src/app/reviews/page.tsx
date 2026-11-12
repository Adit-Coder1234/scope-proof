"use client";

import { useEffect, useState } from "react";
import {
  fetchReviews,
  submitReviewDecision,
  promoteReviewToTest
} from "@/lib/api";
import {
  ShieldAlert,
  CheckCircle,
  XCircle,
  Edit3,
  TestTube2,
  Clock,
  User,
  Bot,
  Filter,
  CheckCheck,
  AlertCircle
} from "lucide-react";

export default function ReviewQueuePage() {
  const [reviews, setReviews] = useState<any[]>([]);
  const [statusFilter, setStatusFilter] = useState("PENDING");
  const [loading, setLoading] = useState(true);

  // Edit Modal State
  const [editingItem, setEditingItem] = useState<any | null>(null);
  const [editedUtterance, setEditedUtterance] = useState("");
  const [reviewNotes, setReviewNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    loadReviews();
  }, [statusFilter]);

  async function loadReviews() {
    setLoading(true);
    try {
      const data = await fetchReviews(statusFilter === "ALL" ? undefined : statusFilter);
      setReviews(data);
    } catch (err) {
      console.error("Error loading reviews:", err);
    } finally {
      setLoading(false);
    }
  }

  async function handleDecision(
    item: any,
    decision: "APPROVED" | "REJECTED",
    promoteToTest: boolean = false
  ) {
    try {
      await submitReviewDecision(item.id, {
        decision,
        decidedBy: "Human Reviewer (Web UI)",
        promoteToTest
      });
      await loadReviews();
    } catch (err) {
      alert("Error submitting decision: " + err);
    }
  }

  async function handlePromote(item: any) {
    try {
      const res = await promoteReviewToTest(item.id);
      alert(`Success! Promoted to regression test case #${res.testCase.id.slice(-6)}`);
      await loadReviews();
    } catch (err) {
      alert("Error promoting to test case: " + err);
    }
  }

  async function handleSaveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editingItem || !editedUtterance.trim()) return;
    setIsSubmitting(true);
    try {
      await submitReviewDecision(editingItem.id, {
        decision: "EDITED",
        editedUtterance: editedUtterance.trim(),
        notes: reviewNotes.trim(),
        decidedBy: "Human Reviewer (Web UI)"
      });
      setEditingItem(null);
      await loadReviews();
    } catch (err) {
      alert("Error saving edited utterance: " + err);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="space-y-8">
      {/* Header & Filter Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900/70 border border-slate-800 p-6 rounded-2xl shadow-xl backdrop-blur-md">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-black text-white flex items-center gap-3">
              <ShieldAlert className="w-7 h-7 text-amber-400" />
              Human Review Queue
            </h1>
            <span className="px-3 py-0.5 rounded-full text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
              Task 5.4 & 5.5
            </span>
          </div>
          <p className="text-sm text-slate-400 mt-1">
            Review turns held by the validation gate for safety, grounding breaches, or unapproved commitments.
          </p>
        </div>

        {/* Filter Buttons */}
        <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800">
          {["PENDING", "APPROVED", "EDITED", "REJECTED", "ALL"].map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                statusFilter === st
                  ? "bg-indigo-600 text-white shadow"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      {/* Review Items List */}
      <div className="space-y-6">
        {loading ? (
          <div className="flex items-center justify-center py-20 text-slate-400">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-500 mr-3"></div>
            Loading review queue...
          </div>
        ) : reviews.length === 0 ? (
          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-12 text-center text-slate-400">
            <CheckCheck className="w-12 h-12 text-emerald-400 mx-auto mb-3 opacity-60" />
            <h3 className="text-base font-bold text-slate-200">No {statusFilter} review items</h3>
            <p className="text-xs text-slate-500 mt-1">
              All risky agent utterances in this status have been addressed.
            </p>
          </div>
        ) : (
          reviews.map((item: any) => {
            const turn = item.turn || {};
            const flags = turn.flags || [];

            return (
              <div
                key={item.id}
                className="bg-slate-900/70 border border-slate-800 rounded-2xl overflow-hidden shadow-xl"
              >
                {/* Item Top Bar */}
                <div className="bg-slate-950/80 px-6 py-4 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-mono font-bold text-white">
                      Review #{item.id.slice(-8)}
                    </span>
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                        item.status === "PENDING"
                          ? "bg-amber-500/20 text-amber-300 border border-amber-500/40 animate-pulse"
                          : item.status === "APPROVED"
                          ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                          : item.status === "EDITED"
                          ? "bg-indigo-500/20 text-indigo-300 border border-indigo-500/40"
                          : "bg-rose-500/20 text-rose-300 border border-rose-500/40"
                      }`}
                    >
                      {item.status}
                    </span>
                    <span className="text-xs text-slate-400 font-mono">
                      Turn #{turn.idx} &bull; Call: {turn.callId?.slice(-6)}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-500 flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" />
                      {new Date(item.createdAt).toLocaleTimeString()}
                    </span>

                    {item.promotedCaseId && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/40">
                        <TestTube2 className="w-3 h-3" /> Promoted to Test Case #{item.promotedCaseId.slice(-6)}
                      </span>
                    )}
                  </div>
                </div>

                {/* Content & Dialogue */}
                <div className="p-6 space-y-4">
                  {/* Flags Bar */}
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-xs font-semibold text-slate-400 mr-1">Breach Triggers:</span>
                    {flags.map((flag: string, fIdx: number) => (
                      <span
                        key={fIdx}
                        className="px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-rose-950/60 text-rose-300 border border-rose-800/40"
                      >
                        {flag}
                      </span>
                    ))}
                    {turn.judgeScore !== null && (
                      <span className="px-2 py-0.5 rounded text-[11px] font-mono bg-slate-800 text-slate-300 border border-slate-700">
                        Judge Score: {(turn.judgeScore * 100).toFixed(0)}%
                      </span>
                    )}
                  </div>

                  {/* Utterance Comparison */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                    <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 space-y-1.5">
                      <span className="font-bold text-slate-400 flex items-center gap-1.5 uppercase tracking-wider text-[10px]">
                        <User className="w-3.5 h-3.5 text-slate-400" /> Caller Spoke
                      </span>
                      <p className="text-slate-100 text-sm font-medium">{turn.callerText}</p>
                    </div>

                    <div className="p-4 rounded-xl bg-rose-950/20 border border-rose-900/40 space-y-1.5">
                      <span className="font-bold text-rose-400 flex items-center gap-1.5 uppercase tracking-wider text-[10px]">
                        <AlertCircle className="w-3.5 h-3.5 text-rose-400" /> Blocked Proposed Utterance (Held by Gate)
                      </span>
                      <p className="text-rose-100 text-sm font-medium font-mono">
                        {turn.proposed?.proposed_utterance}
                      </p>
                    </div>
                  </div>

                  {/* Fallback Utterance Actually Spoken to Caller */}
                  <div className="p-3 rounded-lg bg-indigo-950/30 border border-indigo-900/40 text-xs">
                    <span className="font-bold text-indigo-400 uppercase tracking-wider text-[10px] block mb-1">
                      Safe Fallback Utterance Spoken on Call:
                    </span>
                    <p className="text-indigo-200">{turn.spoken}</p>
                  </div>

                  {/* Judge Evaluation Reason */}
                  {turn.judgeReason && (
                    <div className="text-xs text-slate-400 bg-slate-950/50 p-3 rounded-lg border border-slate-800">
                      <strong className="text-slate-200">Judge Reason: </strong>
                      {turn.judgeReason}
                    </div>
                  )}

                  {/* Action Buttons for Pending Items */}
                  {item.status === "PENDING" && (
                    <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-800">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleDecision(item, "APPROVED")}
                          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-600/20 transition"
                        >
                          <CheckCircle className="w-4 h-4" /> Approve (Override)
                        </button>
                        <button
                          onClick={() => {
                            setEditingItem(item);
                            setEditedUtterance(turn.proposed?.proposed_utterance || "");
                            setReviewNotes("");
                          }}
                          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-600/20 transition"
                        >
                          <Edit3 className="w-4 h-4" /> Edit Utterance
                        </button>
                        <button
                          onClick={() => handleDecision(item, "REJECTED")}
                          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-rose-600 hover:bg-rose-500 text-white shadow-md shadow-rose-600/20 transition"
                        >
                          <XCircle className="w-4 h-4" /> Reject (Confirm Breach)
                        </button>
                      </div>

                      <button
                        onClick={() => handlePromote(item)}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-amber-600/90 hover:bg-amber-600 text-white shadow-md shadow-amber-600/20 transition"
                      >
                        <TestTube2 className="w-4 h-4" /> Promote to Regression Test
                      </button>
                    </div>
                  )}

                  {/* If already decided, show Promote button if not yet promoted */}
                  {item.status !== "PENDING" && !item.promotedCaseId && (
                    <div className="flex justify-end pt-2 border-t border-slate-800">
                      <button
                        onClick={() => handlePromote(item)}
                        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-indigo-300 border border-indigo-500/30 transition"
                      >
                        <TestTube2 className="w-4 h-4" /> Promote to Regression Test
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Edit Utterance Modal */}
      {editingItem && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <form
            onSubmit={handleSaveEdit}
            className="bg-slate-900 border border-slate-800 rounded-2xl max-w-2xl w-full p-6 space-y-5 shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Edit3 className="w-5 h-5 text-indigo-400" />
                Edit Approved Utterance
              </h3>
              <button
                type="button"
                onClick={() => setEditingItem(null)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3">
              <label className="block text-xs font-semibold text-slate-300">
                Corrected Utterance for Agent:
              </label>
              <textarea
                rows={3}
                value={editedUtterance}
                onChange={(e) => setEditedUtterance(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-sm text-slate-200 focus:outline-none focus:border-indigo-500 font-medium"
                required
              />

              <label className="block text-xs font-semibold text-slate-300 mt-2">
                Review Notes & Audit Justification:
              </label>
              <input
                type="text"
                placeholder="e.g. Corrected to defer to recruiter Jenkins per policy."
                value={reviewNotes}
                onChange={(e) => setReviewNotes(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setEditingItem(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-800 text-slate-300 hover:bg-slate-700"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-600/30"
              >
                {isSubmitting ? "Saving..." : "Save & Update Status to EDITED"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

