# Sample Pull Request Description: Quality Gate & Telephony Hardening

## Title: `feat(gate): add pre-TTS commitment verification, held-turn audio masking, and WhatsApp review webhooks`

### Summary
This PR implements the core quality layer for ScopeProof voice agents:
1. **Pre-TTS Inline Gate (`services/agent/gate.py`)**: Intercepts LLM utterances before audio synthesis. If an utterance violates `NEVER_SAY` rules (e.g., hallucinated pay rates) or makes an ungrounded claim, it substitutes a pre-approved client fallback line and flags the turn for human review.
2. **Held-Turn Path for Commitments (`services/agent/worker.py`)**: For turns marked with `is_commitment == true`, streams an immediate audible hold line (*"One moment please, let me verify that slot on our calendar."*) to eliminate dead air while fact verification runs.
3. **Next.js 15 Web Dashboard (`apps/web`)**: Provides full visual UI for Scope editing, version diffing, turn-by-turn run reports, live transcript streaming, and 1-click review queue decisions.
4. **WhatsApp & SMS Follow-ups (`apps/api/src/routes/whatsapp.ts`)**: Integrates Meta/Twilio webhooks with HMAC-SHA256 signature verification, post-call confirmation messages, and remote reviewer decision handling (`APPROVE` / `REJECT`).

---

### Test Evidence & Coverage

#### 1. Backend API Automated Tests (`apps/api`)
```text
✔ GET /health returns 200 with status: ok (95ms)
✔ Review & Promote Lifecycle: list reviews, submit decision, and promote to test (372ms)
✔ Run lifecycle: create run, record calls, turns, review item, and query result (221ms)
✔ GET /api/scopes returns seeded scopes with rules and facts (105ms)
✔ POST /api/scopes/:id/version increments scope version and copies rules (41ms)
✔ GET /api/scopes/:id/cases loads seeded fallback cases including F1-F4 (12ms)
✔ POST /api/scopes/:id/cases rejects malformed test case payloads (24ms)
✔ 6.1 Webhook verification handshake (GET): returns challenge on valid token (50ms)
✔ 6.1 Webhook verification handshake (GET): rejects invalid verify_token with 403 (4ms)
✔ 6.2 Webhook signature validation (POST): rejects invalid signature with 401 (24ms)
✔ 6.2 Webhook signature validation (POST): accepts valid HMAC-SHA256 signature (4ms)
✔ 6.4 Reviewer quick-reply command via WhatsApp webhook: updates ReviewItem status and logs audit (74ms)
✔ 6.3 Utility-template follow-up after call end: creates FollowUp in database (21ms)

Total: 13 passed, 0 failed
```

#### 2. Python Agent Gate Tests (`services/agent`)
```text
tests/test_gate.py::test_f1_invented_pay_fails_without_gate_passes_with_gate PASSED
tests/test_gate.py::test_f2_impossible_slot_fails_without_gate_passes_with_gate PASSED
tests/test_gate.py::test_f3_promise_outside_scope_fails_without_gate_passes_with_gate PASSED
tests/test_gate.py::test_f4_opt_out_handled_politely PASSED
tests/test_harness.py::test_harness_runs_and_stores_records_in_postgres PASSED
tests/test_turn.py::test_generate_turn_live_groq_returns_valid_structured_turn PASSED

Total: 6 passed, 0 failed
```

#### 3. Python Evaluation & Judge Tests (`services/eval`)
```text
tests/test_contracts.py::test_agent_turn_valid PASSED
tests/test_contracts.py::test_agent_turn_invalid_confidence PASSED
tests/test_contracts.py::test_gate_result_valid PASSED
tests/test_contracts.py::test_gate_result_invalid_outcome PASSED
tests/test_contracts.py::test_scope_rule_and_fact_valid PASSED
tests/test_contracts.py::test_review_decision_valid PASSED
tests/test_generator.py::test_generator_live_groq_creates_valid_cases PASSED
tests/test_generator.py::test_generator_retries_on_invalid_output PASSED
tests/test_judge.py::test_judge_scores_bad_invented_pay_turn_low PASSED
tests/test_judge.py::test_judge_scores_good_polite_deferral_high PASSED

Total: 10 passed, 0 failed
```

#### 4. End-to-End Live Voice Calls (LiveKit Cloud)
- **Happy Path Call**: `scopeproof-happy_path-00359549` (Call ID `cmvtadexs000bux8w419c9odk`, p50 latency: 4009ms, gate verdict: `PASS`).
- **Adversarial Salary Call**: `scopeproof-salary_adversarial-6fd821d2` (Call ID `cmvtahow0000vux8wcwbxocan`, p50 latency: 4615ms, gate verdict: `FALLBACK`). ReviewItem `cmvtai6rl0011ux8w4ovlwmlt` queued in database.

---

### Migration & Deployment Notes
- Run `pnpm --filter @scopeproof/contracts prisma:deploy` to apply schema updates.
- Ensure `.env` includes Groq API key, LiveKit credentials, and Twilio trial credentials.

