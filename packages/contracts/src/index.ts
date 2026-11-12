import { z } from "zod";

export const RuleKindSchema = z.enum([
  "MUST_ANSWER",
  "NEVER_SAY",
  "HANDOFF",
  "DISCLOSURE"
]);
export type RuleKind = z.infer<typeof RuleKindSchema>;

export const GateOutcomeSchema = z.enum(["PASS", "FALLBACK", "REVIEW"]);
export type GateOutcome = z.infer<typeof GateOutcomeSchema>;

export const ScopeStatusSchema = z.enum(["DRAFT", "ACTIVE", "ARCHIVED"]);
export type ScopeStatus = z.infer<typeof ScopeStatusSchema>;

export const CaseSourceSchema = z.enum([
  "GENERATED",
  "REVIEW_PROMOTED",
  "MANUAL"
]);
export type CaseSource = z.infer<typeof CaseSourceSchema>;

export const ReviewStatusSchema = z.enum([
  "PENDING",
  "APPROVED",
  "EDITED",
  "REJECTED"
]);
export type ReviewStatus = z.infer<typeof ReviewStatusSchema>;

export const CarrierSchema = z.enum(["TELNYX", "PLIVO", "TWILIO"]);
export type Carrier = z.infer<typeof CarrierSchema>;

export const AgentClaimSchema = z.object({
  claim: z.string(),
  fact_id: z.string()
});
export type AgentClaim = z.infer<typeof AgentClaimSchema>;

export const AgentTurnSchema = z.object({
  intent: z.string(),
  is_commitment: z.boolean(),
  claims: z.array(AgentClaimSchema),
  proposed_utterance: z.string(),
  confidence: z.number().min(0).max(1),
  action: z.string().optional(),
  action_params: z.record(z.unknown()).optional()
});
export type AgentTurn = z.infer<typeof AgentTurnSchema>;

export const GateResultSchema = z.object({
  outcome: GateOutcomeSchema,
  spoken: z.string(),
  failed_layer: z
    .enum(["SCHEMA", "RULE", "GROUNDING", "JUDGE", "THRESHOLD"])
    .optional(),
  tripped_rules: z.array(z.string()),
  missing_fact_ids: z.array(z.string()),
  judge_score: z.number().min(0).max(1).optional(),
  judge_reason: z.string().optional(),
  flags: z.array(z.string())
});
export type GateResult = z.infer<typeof GateResultSchema>;

export const ScopeRuleSchema = z.object({
  id: z.string(),
  scope_id: z.string(),
  kind: RuleKindSchema,
  text: z.string(),
  params: z.record(z.unknown())
});
export type ScopeRule = z.infer<typeof ScopeRuleSchema>;

export const FactSchema = z.object({
  id: z.string(),
  scope_id: z.string(),
  key: z.string(),
  value: z.string()
});
export type Fact = z.infer<typeof FactSchema>;

export const ScriptTurnSchema = z.object({
  role: z.enum(["caller", "agent"]),
  content: z.string(),
  expected_gate: GateOutcomeSchema.optional()
});
export type ScriptTurn = z.infer<typeof ScriptTurnSchema>;

export const TestCaseSchema = z.object({
  id: z.string(),
  scope_id: z.string(),
  rule_id: z.string().optional(),
  persona: z.record(z.unknown()),
  script: z.array(ScriptTurnSchema),
  language: z.string().default("en"),
  source: CaseSourceSchema
});
export type TestCase = z.infer<typeof TestCaseSchema>;

export const ReviewDecisionSchema = z.object({
  review_item_id: z.string(),
  decision: z.enum(["APPROVED", "EDITED", "REJECTED"]),
  edited_utterance: z.string().optional(),
  notes: z.string().optional(),
  promote_to_test: z.boolean().default(false)
});
export type ReviewDecision = z.infer<typeof ReviewDecisionSchema>;

