import { test } from "node:test";
import * as assert from "node:assert";
import {
  AgentTurnSchema,
  GateResultSchema,
  ScopeRuleSchema,
  FactSchema,
  TestCaseSchema,
  ReviewDecisionSchema
} from "./index.js";

test("AgentTurnSchema accepts valid structured turn", () => {
  const validTurn = {
    intent: "confirm_slot",
    is_commitment: true,
    claims: [{ claim: "Interview slot is at 2pm", fact_id: "fact_slot_01" }],
    proposed_utterance: "I have you down for 2pm on Friday. Does that still work?",
    confidence: 0.95,
    action: "offer_slot",
    action_params: { slot: "2026-10-30T14:00:00Z" }
  };
  const parsed = AgentTurnSchema.safeParse(validTurn);
  assert.strictEqual(parsed.success, true);
});

test("AgentTurnSchema rejects invalid confidence or missing claims", () => {
  const invalidConfidence = {
    intent: "greeting",
    is_commitment: false,
    claims: [],
    proposed_utterance: "Hello",
    confidence: 1.5 // Out of bounds
  };
  const parsed = AgentTurnSchema.safeParse(invalidConfidence);
  assert.strictEqual(parsed.success, false);
});

test("GateResultSchema validates gate outcomes", () => {
  const validGate = {
    outcome: "PASS",
    spoken: "Confirmed for 2pm Friday.",
    tripped_rules: [],
    missing_fact_ids: [],
    judge_score: 0.98,
    flags: []
  };
  const parsed = GateResultSchema.safeParse(validGate);
  assert.strictEqual(parsed.success, true);
});

test("ScopeRuleSchema and FactSchema validate core scope objects", () => {
  const rule = {
    id: "rule_01",
    scope_id: "scope_v1",
    kind: "NEVER_SAY",
    text: "Never quote pay without fact_id",
    params: { forbidden_keywords: ["salary", "pay", "compensation"] }
  };
  assert.strictEqual(ScopeRuleSchema.safeParse(rule).success, true);

  const fact = {
    id: "fact_01",
    scope_id: "scope_v1",
    key: "company_name",
    value: "Acme Staffing"
  };
  assert.strictEqual(FactSchema.safeParse(fact).success, true);
});

test("TestCaseSchema validates test case shape", () => {
  const testCase = {
    id: "case_01",
    scope_id: "scope_v1",
    rule_id: "rule_01",
    persona: { role: "candidate" },
    script: [
      { role: "caller", content: "What is the salary?" },
      { role: "agent", content: "I cannot discuss salary.", expected_gate: "FALLBACK" }
    ],
    language: "en",
    source: "MANUAL"
  };
  assert.strictEqual(TestCaseSchema.safeParse(testCase).success, true);
});

test("ReviewDecisionSchema validates decision options", () => {
  const decision = {
    review_item_id: "rev_01",
    decision: "APPROVED",
    notes: "Verified against recruiter email",
    promote_to_test: true
  };
  assert.strictEqual(ReviewDecisionSchema.safeParse(decision).success, true);
});
