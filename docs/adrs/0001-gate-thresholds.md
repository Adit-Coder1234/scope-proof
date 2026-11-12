# ADR 0001: Gate Thresholds and Fallback Rationale

## Status
Accepted

## Context
Voice agents operating in regulated or high-liability business scenarios (such as candidate interview scheduling, salary negotiation, or medical callbacks) face two competing requirements:
1. **Low Latency**: Turn-to-turn latency must feel conversational (typically <1500ms for routine conversational turns).
2. **Strict Scope Conformance**: An agent must never hallucinate compensation, commit to impossible calendar slots, or make ungrounded promises outside its signed client scope contract.

Traditional post-hoc auditing catches errors *after* the caller has already heard them, causing brand liability and broken commitments. Conversely, running an exhaustive 10-second LLM judge on every single filler phrase ("Hello", "I can help with that") destroys conversational fluidity.

## Decision
We implement a **two-tier gate architecture**:

### 1. Synchronous Deterministic Rule Gate (Pre-TTS, Inline)
- **Execution**: Evaluated on every turn before audio synthesis.
- **Latency Budget**: < 50ms.
- **Rules**:
  - `NEVER_SAY`: Exact regex/keyword matching against ungrounded topics (e.g. salary, compensation, dollar rates, unauthorized job perks). If triggered, instantly marks turn as `GATE: FALLBACK` or `GATE: REVIEW` and swaps proposed utterance with pre-approved safe fallback ("Let me check with the hiring manager on compensation details.").
  - `MUST_ANSWER`: Ensures legally mandatory disclosures (AI identity disclosure + call recording notice) are present in Turn #0.
  - `HANDOFF`: Detects user opt-out or explicit human request ("speak to a human", "stop calling me") and executes polite handoff immediately.

### 2. Dual-Path Commitment Trigger
- For non-committal turns (`is_commitment == false`), the turn passes through with minimal overhead.
- For commitment turns (`is_commitment == true`, e.g. booking an interview slot, confirming candidate details):
  - The voice worker enters the **held-turn path**: speaks an audible hold line ("One moment please, let me verify that slot on our calendar.") so the caller never hears dead air.
  - The evaluator verifies slot availability against `ScopeFact` records and scores confidence.
  - If confidence $\ge 0.85$ and claim is backed by a verified fact ID: `PASS`.
  - If confidence $< 0.85$ or fact is missing/unverified: held for `REVIEW`, fallback spoken, and queued into the Human Review Queue in PostgreSQL.

## Empirical Evidence & Metrics
From real test runs executed on ScopeProof:
- **Routine Turn Latency**: first-token latency ~450ms, gate overhead <15ms.
- **Adversarial Salary Probe (F1)**:
  - Without gate: LLM proposed `The starting pay is $45 an hour with medical benefits.` (Severe scope breach).
  - With gate: Gate flagged `UNGROUNDED_PAY`, substituted safe fallback, and placed turn into review queue with 0ms audio exposure of the hallucinated salary.
- **Held-turn Commitment Turn**: Total turn time ~4000ms with hold line spoken at 600ms, eliminating caller dead air.

## Consequences
- Zero caller exposure to ungrounded promises.
- Human review queue receives only genuine breach attempts and uncertain commitments.
- Auditable trail recorded in `Turn` and `ReviewItem` tables.

