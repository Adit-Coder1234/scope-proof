const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api";

export async function fetchScopes() {
  const res = await fetch(`${API_BASE}/scopes`, { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to fetch scopes");
  return res.json();
}

export async function fetchScope(id: string) {
  const res = await fetch(`${API_BASE}/scopes/${id}`, { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to fetch scope");
  return res.json();
}

export async function bumpScopeVersion(id: string) {
  const res = await fetch(`${API_BASE}/scopes/${id}/version`, {
    method: "POST"
  });
  if (!res.ok) throw new Error("Failed to bump scope version");
  return res.json();
}

export async function addRule(scopeId: string, rule: { kind: string; text: string; params?: Record<string, unknown> }) {
  const res = await fetch(`${API_BASE}/scopes/${scopeId}/rules`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(rule)
  });
  if (!res.ok) throw new Error("Failed to add rule");
  return res.json();
}

export async function addFact(scopeId: string, fact: { key: string; value: string }) {
  const res = await fetch(`${API_BASE}/scopes/${scopeId}/facts`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(fact)
  });
  if (!res.ok) throw new Error("Failed to add fact");
  return res.json();
}

export async function fetchScopeDiff(scopeId: string, compareWithId?: string) {
  const url = compareWithId
    ? `${API_BASE}/scopes/${scopeId}/diff?compareWith=${compareWithId}`
    : `${API_BASE}/scopes/${scopeId}/diff`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to fetch scope diff");
  return res.json();
}

export async function fetchRuns(scopeId?: string) {
  const url = scopeId ? `${API_BASE}/runs?scopeId=${scopeId}` : `${API_BASE}/runs`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to fetch runs");
  return res.json();
}

export async function fetchRun(id: string) {
  const res = await fetch(`${API_BASE}/runs/${id}`, { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to fetch run report");
  return res.json();
}

export async function fetchCall(id: string) {
  const res = await fetch(`${API_BASE}/calls/${id}`, { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to fetch call transcript");
  return res.json();
}

export async function fetchReviews(status?: string) {
  const url = status ? `${API_BASE}/reviews?status=${status}` : `${API_BASE}/reviews`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to fetch review items");
  return res.json();
}

export async function submitReviewDecision(
  id: string,
  payload: {
    decision: "APPROVED" | "EDITED" | "REJECTED";
    editedUtterance?: string;
    notes?: string;
    decidedBy?: string;
    promoteToTest?: boolean;
  }
) {
  const res = await fetch(`${API_BASE}/reviews/${id}/decision`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  if (!res.ok) throw new Error("Failed to submit review decision");
  return res.json();
}

export async function promoteReviewToTest(id: string) {
  const res = await fetch(`${API_BASE}/reviews/${id}/promote`, {
    method: "POST"
  });
  if (!res.ok) throw new Error("Failed to promote review to test");
  return res.json();
}
