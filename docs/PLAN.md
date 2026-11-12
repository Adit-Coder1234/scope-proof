# ScopeProof — Build Plan

## Step-back analysis

Why do voice-agent builds fail in practice?

1. **Unverified agent behaviour.** The agent's scope lives in a doc and in someone's head. When a prompt, model or knowledge sheet changes, nobody proves the agent still honours the scope until a client phones it. Surprises surface at demo day.
2. **Invisible delivery.** There's no artefact that says "here is what the agent did, here is where it stayed inside bounds." The client has to trust the agency.
3. **Fragmented follow-up.** Post-call actions (confirmations, callbacks, review decisions) scatter across WhatsApp, email, and memory. Nothing ties them back to the call or the scope.

Every phase below addresses at least one of these.

---

## Environment & Model Architecture (Anti-Hallucination Setup)

To eliminate self-grading bias and prevent hallucination loops while keeping latency sub-second on a single API key:
- **Agent Brain (Conversation):** Meta `llama-3.3-70b-versatile` via Groq. Responsible for conversational turns and structured claims.
- **Judge & Test Generator (Cross-Model Evaluation):** Mistral AI `mixtral-8x7b-32768` via Groq. A completely distinct model family, architecture, and weights. Ensures a model does not grade its own homework or share identical blind spots.
- **Deterministic Gate (Primary Defense):** Python schema, regex rules, and Fact-ID grounding against Postgres execute before any spoken output. Hallucinations on facts/figures are blocked deterministically before the judge ever runs.

| Tool             | Version  | Notes                           |
|------------------|----------|---------------------------------|
| Node.js          | 24.12.0  |                                 |
| npm              | 11.7.0   |                                 |
| pnpm             | 10.27.0  | Monorepo package manager        |
| Python           | 3.14     |                                 |
| pip              | 26.2.1   |                                 |
| uv               | 0.12.3   | Python env management           |
| Docker           | 29.4.3   |                                 |
| Docker Compose   | 5.1.3    | PostgreSQL will run here        |
| psql             | —        | Not on PATH; use Docker pg      |
| Yarn             | —        | Not installed; using pnpm       |
| LLM Provider     | Groq     | Ultra-fast token latency for voice agent & eval |
| Agent Model      | llama-3.3-70b-versatile | High instruction compliance for structured JSON |
| Judge/Gen Model  | mixtral-8x7b-32768     | Independent architecture for cross-model judging |

---

## P1 — Foundation

| # | Task | Acceptance criterion | Verify command |
|---|------|---------------------|----------------|
| 1.1 | Init pnpm workspace monorepo with `apps/web`, `apps/api`, `packages/contracts`, `services/agent`, `services/caller`, `services/eval` | `pnpm install` succeeds from root | `pnpm install && echo OK` |
| 1.2 | `packages/contracts`: Zod schemas for AgentTurn, GateResult, ScopeRule, Fact, TestCase, ReviewDecision; JSON Schema export; TypeScript strict | `pnpm --filter contracts build` passes; exported `.json` schemas exist | `pnpm --filter contracts build && ls packages/contracts/dist/*.json` |
| 1.3 | Docker Compose for PostgreSQL 16 | `docker compose up -d db` starts a reachable PG | `docker compose up -d db && docker compose exec db pg_isready` |
| 1.4 | `apps/api`: Prisma schema (all models from the data-model sketch with correct relations and indexes); first migration | `pnpm --filter api prisma migrate dev` applies cleanly on empty DB | `pnpm --filter api prisma migrate dev --name init` |
| 1.5 | `apps/api`: Node/Express skeleton with health check, validated env config (Zod) | `GET /health` returns 200 with `{ status: "ok" }` | `pnpm --filter api dev & sleep 3 && curl localhost:4000/health` |
| 1.6 | `.env.example` with every variable and placeholder | File exists, no real secrets | `cat .env.example` |
| 1.7 | Python contract mirror: Pydantic models matching the Zod schemas; a cross-language contract test | Test script validates same sample payloads accepted/rejected on both sides | `cd services/eval && uv run pytest tests/test_contracts.py` |
| 1.8 | TypeScript strict, ESLint, Prettier configured; `pnpm typecheck` and `pnpm lint` pass | Zero errors | `pnpm typecheck && pnpm lint` |

**Gate:** Clean DB migration, typecheck + lint pass, contract tests pass (TS and Python).

---

## P2 — Scope contract and test generation

| # | Task | Acceptance criterion | Verify command |
|---|------|---------------------|----------------|
| 2.1 | CRUD endpoints: Tenant, Scope (versioned), Rule, Fact | POST/GET work; a new scope version increments the version number | `pnpm --filter api test -- --grep "scope"` |
| 2.2 | Seed the interview-confirmation scope: MOCK facts (recruiter calendar, company info), rules (MUST_ANSWER, NEVER_SAY, HANDOFF, DISCLOSURE) | Seed script runs and data is queryable | `pnpm --filter api seed && curl localhost:4000/api/scopes` |
| 2.3 | TestCase endpoints and the 15 hand-written fallback cases (including F1–F4) | 15 cases load and validate against the contract schema | `pnpm --filter api test -- --grep "test-cases"` |
| 2.4 | Groq-based test-case generator (using `mixtral-8x7b-32768`): takes scope rules, returns schema-valid test cases; invalid output is rejected and retried (max 2 retries) | Generated cases pass contract validation; deliberately broken output triggers retry | `cd services/eval && uv run pytest tests/test_generator.py` |

**Gate:** Generated and manual cases all validate against contracts; invalid model output never reaches the database.

---

## P3 — Agent brain and validation gate (text mode)

| # | Task | Acceptance criterion | Verify command |
|---|------|---------------------|----------------|
| 3.1 | Python agent core: Groq structured turn using `llama-3.3-70b-versatile` returning AgentTurn JSON (intent, claims with fact_id, proposed_utterance, confidence) | A single turn against a test prompt returns valid AgentTurn | `cd services/agent && uv run pytest tests/test_turn.py` |
| 3.2 | Validation gate: schema check → rule engine → grounding check → threshold | Each layer rejects its specific bad input; layers run in order | `cd services/agent && uv run pytest tests/test_gate.py` |
| 3.3 | Text-mode test harness: runs TestCases against the agent+gate without audio, posts results to Node API | F1–F4 each fail when gate is removed, pass with it | `cd services/agent && uv run pytest tests/test_harness.py` |
| 3.4 | Independent judge in FastAPI eval service using `mixtral-8x7b-32768`: scores groundedness and policy (0–1 with reason) without self-grading bias | Judge returns valid scores for a known-good and known-bad turn | `cd services/eval && uv run pytest tests/test_judge.py` |
| 3.5 | Results flow: agent → Node API → Prisma → Postgres; run records with gate outcomes queryable | After a text-mode run, `GET /api/runs/:id` shows calls, turns, gate outcomes | `pnpm --filter api test -- --grep "run-results"` |

**Gate:** F1–F4 automated tests pass with gate, fail without; run records exist in Postgres with real outcomes.

---

## P4 — Real calls

| # | Task | Acceptance criterion | Verify command |
|---|------|---------------------|----------------|
| 4.1 | LiveKit agent worker: Python agent as a LiveKit participant; AI disclosure + recording notice at call start | Agent joins a LiveKit room and speaks the disclosure | Manual: start agent, connect a test participant, hear disclosure |
| 4.2 | Held-turn path for commitment turns: non-streaming structured call, gate checks inline, hold line on fail | A commitment turn is held and the hold line is spoken before the judge returns | Text-mode test with commitment intent |
| 4.3 | Scripted test caller: Python LiveKit participant that follows a TestCase script over audio | Caller completes a scripted conversation | Manual: run caller against agent in a LiveKit room |
| 4.4 | Telnyx SIP: test caller dials out over Telnyx, call lands in LiveKit room | Call connects, audio flows both ways | Manual: caller dials, check LiveKit room participants |
| 4.5 | Inbound & Outbound PSTN Calling: Twilio PSTN gateway dials caller mobile phone, human caller interacts with agent | Inbound and outbound phone calls reach the agent; live transcript is captured | `python services/caller/start_phone_ai.py` |
| 4.6 | Metrics from real timestamps: first-token latency, gate latency, total turn latency | Metrics stored in Turn records with real values from timestamps | `SELECT latency_p50_ms FROM "Call" WHERE ... IS NOT NULL` |

**Owner actions needed before this phase:** LiveKit Cloud credentials; Twilio account & phone number; Telnyx SIP trunk credentials; Groq API key (all configured in `.env`).

**Gate:** One real recorded call end-to-end with turns, gate outcomes, and metrics in Postgres.

---

## P5 — Dashboard and review queue

| # | Task | Acceptance criterion | Verify command |
|---|------|---------------------|----------------|
| 5.1 | Next.js app with pages: Scope & Rules editor, Runs list | Pages render with data from the API | `pnpm --filter web build && pnpm --filter web start` |
| 5.2 | Run report page: pass rate by rule and language, turn-level detail | Report shows real data from a completed run | Visual check against API data |
| 5.3 | Live transcript page: streams turns as they happen during a call | Turns appear within seconds of the agent speaking | Manual: run a call, watch transcript |
| 5.4 | Review queue: list held items; Approve / Edit / Reject with one click | A held turn appears; decision is stored with audit entry | `pnpm --filter api test -- --grep "review"` |
| 5.5 | Promote-to-test: a rejected review item becomes a TestCase with source REVIEW_PROMOTED | Promoted case appears in the next run | `pnpm --filter api test -- --grep "promote"` |
| 5.6 | Scope version diff view | Changing a rule and creating a new version shows the diff | Visual check |

**Gate:** A held turn appears in the queue; decision stored with audit; promotion creates a runnable TestCase.

---

## P6 — WhatsApp

| # | Task | Acceptance criterion | Verify command |
|---|------|---------------------|----------------|
| 6.1 | Webhook verification handshake (GET) per Meta docs | Meta's verification request returns the challenge | `curl "localhost:4000/api/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=TOKEN&hub.challenge=test123"` |
| 6.2 | Webhook signature validation (POST) | Invalid signature returns 401; valid signature processes | `pnpm --filter api test -- --grep "whatsapp-sig"` |
| 6.3 | Utility-template follow-up after call end | A real message reaches the owner's phone | Manual: complete a call, check phone |
| 6.4 | Reviewer notification with quick-reply buttons | Button reply updates the ReviewItem status | Manual: receive notification, tap button, check DB |

**Verification Approach:** Meta-compliant webhook verification and HMAC-SHA256 signature test suite (`apps/api/src/routes/whatsapp.test.ts`); Twilio WhatsApp Sandbox for real mobile testing.

**Gate:** Follow-up records logged in Postgres; webhook commands update the review item with full audit log.

---

## P7 — Evidence and handover

| # | Task | Acceptance criterion | Verify command |
|---|------|---------------------|----------------|
| 7.1 | README: from `git clone` to a passing run | A fresh clone follows the README and reaches a working state | Manual walkthrough |
| 7.2 | ADRs: gate thresholds (with tuning rationale), carrier setup, dependency choices | Each ADR references real data or explicit UNVERIFIED markers | Review docs/adrs/ |
| 7.3 | WALKTHROUGH.md: every module explained (inline vs async, judge vs rule engine, what-if scenarios) | A reader can explain any module after reading it | Peer review |
| 7.4 | Scope doc template, PR description sample, handover checklist | Each document exists and references real repo artefacts | `ls docs/` |
| 7.5 | Demo script with pitch lines (finalized only after the system runs) | Pitch lines match what actually ran (correct carriers, real capabilities) | Cross-check with run report |

**Gate:** Fresh clone → README → passing run; every claim in docs backed by repo evidence.

---

## Cut order (if scope must shrink)

1. Language dimension in reports
2. WhatsApp reviewer buttons
3. Scope version diff
4. Groq-generated test cases (keep 15 manual ones)

**Never cut:** the gate, the review queue, one real call, the audit log.
