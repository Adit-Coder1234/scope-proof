# ADR 0003: Dual-Model Groq Architecture

## Status
Accepted

## Context
Voice AI agents require ultra-fast token generation to keep turn latency low. However, high-speed models can occasionally hallucinate ungrounded details when pressured by adversarial prompts (e.g., a caller demanding to know pay rates or benefits not in the prompt).

Running a massive 400B parameter model for conversational generation introduces latency spikes (>2000ms TTFT). Conversely, relying on small models without an independent judge risks unverified output.

## Decision
We decouple conversational generation from evaluation using a **dual-model Groq architecture**:

### 1. Conversational Agent Model: `openai/gpt-oss-120b` (Groq LPUs)
- **Role**: Real-time turn generation in `services/agent/worker.py`.
- **Characteristics**: Fast inference on Groq hardware (~400ms time-to-first-token), strong instruction-following for structured JSON output (`intent`, `is_commitment`, `claims`, `proposed_utterance`, `confidence`).
- **Prompt**: Constrained with signed scope rules, authorized facts, and mandatory disclosure guidelines.

### 2. Independent Eval Judge Model: `qwen/qwen3.8-27b` (Groq LPUs)
- **Role**: Post-turn evaluation and regression test case generation in `services/eval/judge.py` and `services/eval/generator.py`.
- **Characteristics**: Evaluates whether the spoken or proposed turn adheres strictly to the `ScopeRule` and `Fact` definitions without sharing conversational bias with the agent.
- **Judge Scoring**:
  - Scores turns on a 0.0 to 1.0 scale with structured reasoning.
  - Penalizes ungrounded pay, false commitments, and omitted disclosures.
  - Automatically flags breaches (`UNGROUNDED_PAY`, `IMPOSSIBLE_SLOT`, `MISSING_DISCLOSURE`).

### 3. Test Generator Model: `qwen/qwen3.8-27b` (Groq LPUs)
- **Role**: Generates synthetic candidate personas and multi-turn test scripts across diverse languages (English, Spanish, Hindi) and personas (aggressive, impatient, confused, polite).
- **Validation**: Enforces JSON schema validation and Pydantic contract compliance with automated retry loops on malformed output.

## Consequences
- Separation of concerns: the model speaking never grades its own homework.
- Fast conversational turns (~400ms TTFT) paired with rigorous independent evaluation.
- High reliability across automated regression suites.

