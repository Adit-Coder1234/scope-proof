"use client";

import { useEffect, useState } from "react";
import {
  fetchScopes,
  bumpScopeVersion,
  addRule,
  addFact,
  fetchScopeDiff
} from "@/lib/api";
import type { Scope, ScopeRule, ScopeFact, ScopeDiff } from "@/lib/types";
import {
  ShieldAlert,
  ShieldCheck,
  PhoneForwarded,
  MessageSquare,
  Plus,
  GitCompare,
  Database,
  History,
  CheckCircle2
} from "lucide-react";

export default function ScopesPage() {
  const [, setScopes] = useState<Scope[]>([]);
  const [selectedScope, setSelectedScope] = useState<Scope | null>(null);
  const [loading, setLoading] = useState(true);
  const [diffModalOpen, setDiffModalOpen] = useState(false);
  const [diffData, setDiffData] = useState<ScopeDiff | null>(null);

  // New Rule Form State
  const [ruleKind, setRuleKind] = useState("NEVER_SAY");
  const [ruleText, setRuleText] = useState("");
  const [isSubmittingRule, setIsSubmittingRule] = useState(false);

  // New Fact Form State
  const [factKey, setFactKey] = useState("recruiter_calendar_slot");
  const [factValue, setFactValue] = useState("");
  const [isSubmittingFact, setIsSubmittingFact] = useState(false);

  useEffect(() => {
    loadScopes();
  }, []);

  async function loadScopes() {
    setLoading(true);
    try {
      const data = await fetchScopes();
      setScopes(data);
      if (data.length > 0) {
        // Select latest active scope
        const active = data.find((s: any) => s.status === "ACTIVE") || data[0];
        setSelectedScope(active);
      }
    } catch (err) {
      console.error("Error loading scopes:", err);
    } finally {
      setLoading(false);
    }
  }

  async function handleBumpVersion() {
    if (!selectedScope) return;
    try {
      const newScope = await bumpScopeVersion(selectedScope.id);
      await loadScopes();
      setSelectedScope(newScope);
    } catch (err) {
      alert("Error bumping scope version: " + err);
    }
  }

  async function handleOpenDiff() {
    if (!selectedScope) return;
    try {
      const diff = await fetchScopeDiff(selectedScope.id);
      setDiffData(diff);
      setDiffModalOpen(true);
    } catch (err) {
      alert("Error loading version diff: " + err);
    }
  }

  async function handleAddRule(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedScope || !ruleText.trim()) return;
    setIsSubmittingRule(true);
    try {
      await addRule(selectedScope.id, {
        kind: ruleKind,
        text: ruleText.trim(),
        params: {}
      });
      setRuleText("");
      await loadScopes();
    } catch (err) {
      alert("Error adding rule: " + err);
    } finally {
      setIsSubmittingRule(false);
    }
  }

  async function handleAddFact(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedScope || !factValue.trim()) return;
    setIsSubmittingFact(true);
    try {
      await addFact(selectedScope.id, {
        key: factKey.trim(),
        value: factValue.trim()
      });
      setFactValue("");
      await loadScopes();
    } catch (err) {
      alert("Error adding fact: " + err);
    } finally {
      setIsSubmittingFact(false);
    }
  }

  const getKindBadge = (kind: string) => {
    switch (kind) {
      case "NEVER_SAY":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-500/20 text-rose-300 border border-rose-500/30">
            <ShieldAlert className="w-3.5 h-3.5" /> NEVER_SAY
          </span>
        );
      case "MUST_ANSWER":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
            <ShieldCheck className="w-3.5 h-3.5" /> MUST_ANSWER
          </span>
        );
      case "HANDOFF":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/30">
            <PhoneForwarded className="w-3.5 h-3.5" /> HANDOFF
          </span>
        );
      case "DISCLOSURE":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
            <MessageSquare className="w-3.5 h-3.5" /> DISCLOSURE
          </span>
        );
      default:
        return (
          <span className="px-2 py-0.5 rounded text-xs bg-slate-800 text-slate-300">
            {kind}
          </span>
        );
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-slate-400">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500 mr-3"></div>
        Loading client scope contracts...
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header & Scope Version Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900/70 border border-slate-800 p-6 rounded-2xl shadow-xl backdrop-blur-md">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-black text-white">Scope & Rules Editor</h1>
            <span className="px-3 py-0.5 rounded-full text-xs font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
              v{selectedScope?.version || 1}
            </span>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" /> ACTIVE
            </span>
          </div>
          <p className="text-sm text-slate-400 mt-1">
            Tenant: <strong className="text-slate-200">Apex Staffing Agency (MOCK)</strong> &bull; Scope ID:{" "}
            <code className="text-xs bg-slate-800/80 px-1.5 py-0.5 rounded text-indigo-300">
              {selectedScope?.id}
            </code>
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleOpenDiff}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition shadow"
          >
            <GitCompare className="w-4 h-4 text-indigo-400" /> Version Diff
          </button>
          <button
            onClick={handleBumpVersion}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/30 transition"
          >
            <History className="w-4 h-4" /> Bump to v{(selectedScope?.version || 1) + 1}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left 2 Cols: Rules Registry */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-slate-900/60 border border-slate-800/90 rounded-2xl p-6 shadow-xl">
            <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-800">
              <div>
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-indigo-400" />
                  Scope Boundary Rules ({selectedScope?.rules?.length || 0})
                </h2>
                <p className="text-xs text-slate-400">
                  Where the voice agent must stop, disclose, answer, or hand off.
                </p>
              </div>
            </div>

            {/* Rules List */}
            <div className="space-y-3">
              {selectedScope?.rules?.map((rule: any) => (
                <div
                  key={rule.id}
                  className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-4 hover:border-slate-700 transition"
                >
                  <div className="flex items-center justify-between gap-3 mb-2">
                    {getKindBadge(rule.kind)}
                    <code className="text-[10px] text-slate-400 font-mono">
                      {rule.id}
                    </code>
                  </div>
                  <p className="text-sm text-slate-200 font-medium leading-relaxed">
                    {rule.text}
                  </p>
                </div>
              ))}
            </div>

            {/* Add Rule Form */}
            <form onSubmit={handleAddRule} className="mt-6 pt-5 border-t border-slate-800/80 space-y-4">
              <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
                <Plus className="w-4 h-4 text-indigo-400" /> Add Rule to Scope
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <select
                  value={ruleKind}
                  onChange={(e) => setRuleKind(e.target.value)}
                  className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-indigo-500"
                >
                  <option value="NEVER_SAY">NEVER_SAY</option>
                  <option value="MUST_ANSWER">MUST_ANSWER</option>
                  <option value="HANDOFF">HANDOFF</option>
                  <option value="DISCLOSURE">DISCLOSURE</option>
                </select>
                <input
                  type="text"
                  placeholder="e.g. Never promise job placement or starting salary."
                  value={ruleText}
                  onChange={(e) => setRuleText(e.target.value)}
                  className="md:col-span-3 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-indigo-500"
                  required
                />
              </div>
              <button
                type="submit"
                disabled={isSubmittingRule}
                className="w-full py-2 px-4 rounded-lg bg-indigo-600/80 hover:bg-indigo-600 text-white font-medium text-sm transition disabled:opacity-50"
              >
                {isSubmittingRule ? "Saving Rule..." : "Save Rule to Contract"}
              </button>
            </form>
          </div>
        </div>

        {/* Right 1 Col: Grounded Facts */}
        <div className="space-y-6">
          <div className="bg-slate-900/60 border border-slate-800/90 rounded-2xl p-6 shadow-xl">
            <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-800">
              <div>
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <Database className="w-5 h-5 text-emerald-400" />
                  Grounded Facts ({selectedScope?.facts?.length || 0})
                </h2>
                <p className="text-xs text-slate-400">
                  Approved claims the agent is allowed to speak.
                </p>
              </div>
            </div>

            {/* Facts List */}
            <div className="space-y-3 max-h-[480px] overflow-y-auto pr-1">
              {selectedScope?.facts?.map((fact: any) => (
                <div
                  key={fact.id}
                  className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3.5 space-y-1 hover:border-slate-700 transition"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-indigo-400 uppercase tracking-wider">
                      {fact.key}
                    </span>
                    <code className="text-[10px] text-slate-400 font-mono">
                      {fact.id.slice(-6)}
                    </code>
                  </div>
                  <p className="text-xs text-slate-300 font-medium leading-relaxed">
                    {fact.value}
                  </p>
                </div>
              ))}
            </div>

            {/* Add Fact Form */}
            <form onSubmit={handleAddFact} className="mt-6 pt-5 border-t border-slate-800/80 space-y-3">
              <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
                <Plus className="w-4 h-4 text-emerald-400" /> Add Grounded Fact
              </h3>
              <input
                type="text"
                placeholder="Fact Key (e.g. recruiter_calendar_slot)"
                value={factKey}
                onChange={(e) => setFactKey(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
                required
              />
              <textarea
                rows={2}
                placeholder="Fact Value (e.g. Tuesday, Nov 4, 2026 at 3:00 PM IST)"
                value={factValue}
                onChange={(e) => setFactValue(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
                required
              />
              <button
                type="submit"
                disabled={isSubmittingFact}
                className="w-full py-2 px-4 rounded-lg bg-emerald-600/80 hover:bg-emerald-600 text-white font-medium text-xs transition disabled:opacity-50"
              >
                {isSubmittingFact ? "Adding Fact..." : "Add Approved Fact"}
              </button>
            </form>
          </div>
        </div>
      </div>

      {/* Version Diff Modal */}
      {diffModalOpen && diffData && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-3xl w-full p-6 space-y-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div>
                <h3 className="text-xl font-bold text-white flex items-center gap-2">
                  <GitCompare className="w-5 h-5 text-indigo-400" />
                  Scope Version Diff
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Comparing Version <strong>v{diffData.currentVersion}</strong> with Version{" "}
                  <strong>{diffData.targetVersion ? `v${diffData.targetVersion}` : "Baseline"}</strong>
                </p>
              </div>
              <button
                onClick={() => setDiffModalOpen(false)}
                className="text-slate-400 hover:text-white px-2 py-1 rounded"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
              {diffData.message ? (
                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-slate-400 text-sm">
                  {diffData.message}
                </div>
              ) : (
                <>
                  {/* Added Rules */}
                  <div>
                    <h4 className="text-xs font-bold text-emerald-400 uppercase tracking-wider mb-2">
                      + Added Rules ({diffData.addedRules?.length || 0})
                    </h4>
                    {diffData.addedRules?.length === 0 ? (
                      <p className="text-xs text-slate-400 italic">No new rules added.</p>
                    ) : (
                      <div className="space-y-2">
                        {diffData.addedRules.map((r: any) => (
                          <div
                            key={r.id}
                            className="bg-emerald-950/20 border border-emerald-500/30 p-3 rounded-lg text-xs text-emerald-200"
                          >
                            <span className="font-bold mr-2">[{r.kind}]</span> {r.text}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Removed Rules */}
                  <div>
                    <h4 className="text-xs font-bold text-rose-400 uppercase tracking-wider mb-2">
                      - Removed Rules ({diffData.removedRules?.length || 0})
                    </h4>
                    {diffData.removedRules?.length === 0 ? (
                      <p className="text-xs text-slate-400 italic">No rules removed.</p>
                    ) : (
                      <div className="space-y-2">
                        {diffData.removedRules.map((r: any) => (
                          <div
                            key={r.id}
                            className="bg-rose-950/20 border border-rose-500/30 p-3 rounded-lg text-xs text-rose-200"
                          >
                            <span className="font-bold mr-2">[{r.kind}]</span> {r.text}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>

            <div className="flex justify-end pt-4 border-t border-slate-800">
              <button
                onClick={() => setDiffModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-sm font-semibold text-slate-200"
              >
                Close Diff
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
