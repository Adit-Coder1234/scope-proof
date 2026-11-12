export interface ScopeRule {
  id: string;
  scopeId: string;
  kind: "MUST_ANSWER" | "NEVER_SAY" | "HANDOFF" | "DISCLOSURE";
  text: string;
  params: Record<string, unknown>;
  createdAt?: string;
}

export interface ScopeFact {
  id: string;
  scopeId: string;
  key: string;
  value: string;
  createdAt?: string;
}

export interface Scope {
  id: string;
  tenantId: string;
  version: number;
  status: "DRAFT" | "ACTIVE" | "ARCHIVED";
  rules: ScopeRule[];
  facts: ScopeFact[];
  createdAt?: string;
  updatedAt?: string;
}

export interface ScopeDiff {
  currentId?: string;
  currentVersion: number;
  targetId?: string | null;
  targetVersion: number | null;
  message?: string;
  addedRules: ScopeRule[];
  removedRules: ScopeRule[];
  addedFacts: ScopeFact[];
  removedFacts: ScopeFact[];
  modifiedFacts: ScopeFact[];
}

export interface ProposedTurn {
  intent: string;
  is_commitment: boolean;
  claims: Array<{ claim: string; fact_id: string }>;
  proposed_utterance: string;
  confidence: number;
  action?: string | null;
  action_params?: Record<string, unknown> | null;
  metrics?: {
    first_token_latency_ms: number;
    gate_latency_ms: number;
    total_turn_latency_ms: number;
  };
}

export interface ReviewItem {
  id: string;
  turnId: string;
  status: "PENDING" | "APPROVED" | "EDITED" | "REJECTED";
  decidedBy?: string | null;
  decision?: Record<string, unknown> | null;
  promotedCaseId?: string | null;
  createdAt: string;
  updatedAt: string;
  turn?: Turn;
}

export interface Turn {
  id: string;
  callId: string;
  idx: number;
  callerText: string;
  proposed: ProposedTurn;
  spoken?: string | null;
  gate: "PASS" | "FALLBACK" | "REVIEW";
  judgeScore?: number | null;
  judgeReason?: string | null;
  flags: string[];
  reviewItem?: ReviewItem | null;
  createdAt: string;
  call?: Call;
}

export interface Call {
  id: string;
  runId?: string | null;
  caseId?: string | null;
  carrier: "TELNYX" | "PLIVO" | "TWILIO";
  livekitRoom: string;
  recordingUrl?: string | null;
  latencyP50Ms?: number | null;
  turns: Turn[];
  createdAt: string;
  run?: Run;
}

export interface Run {
  id: string;
  scopeId: string;
  promptVersion: string;
  model: string;
  startedAt: string;
  completedAt?: string | null;
  passRate?: number | null;
  scope?: { id: string; version: number; tenant?: { name: string } };
  calls: Call[];
  _count?: { calls: number };
}

