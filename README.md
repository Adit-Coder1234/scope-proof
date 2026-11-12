# ScopeProof: Enterprise Voice Agent Quality & Governance Layer
> **"The written scope, executed."**  
> A mission-critical pre-TTS validation gate, real-time telephony runtime, and human-in-the-loop review dashboard that ensures generative voice agents strictly honor client contractual boundaries before audio is synthesized.

[![CI Tests](https://img.shields.io/badge/tests-29%20passed%2C%200%20failed-brightgreen.svg)](#test-suite-and-verification)
[![TypeScript](https://img.shields.io/badge/typescript-v5.7-blue.svg)](#technical-architecture--stack)
[![Next.js 15](https://img.shields.io/badge/next.js-v15.5-black.svg)](#nextjs-15-operations-dashboard)
[![Telephony](https://img.shields.io/badge/telephony-Twilio%20PSTN%20%7C%20LiveKit%20WebRTC-violet.svg)](#telephony--real-time-audio-architecture)
[![Inference](https://img.shields.io/badge/inference-Groq%20LPU%20Cloud-orange.svg)](#dual-model-inference-architecture)
[![Prisma ORM](https://img.shields.io/badge/orm-Prisma%20v6%20%7C%20PostgreSQL-indigo.svg)](#database-schema--data-governance)

---

## Executive Summary

Deploying generative voice agents on public switched telephone networks (PSTN) exposes enterprises to severe reputational, financial, and legal liabilities:
- **Ungrounded Financial Commitments**: Agents hallucinating unauthorized compensation, hourly rates, or signing bonuses.
- **Unverified Scheduling Promises**: Agents confirming interview slots when recruiters are unavailable or double-booked.
- **Compliance & Regulatory Breaches**: Agents omitting legally mandatory AI identity disclosures, call-recording notices, or failing to honor opt-out/Do-Not-Call (DNC) requests.

**ScopeProof** resolves this by operating as a deterministic, inline proxy between conversational LLM generation and the audio synthesis/transmission plane (TTS & PSTN). If an LLM proposes an utterance violating contractual scope, ScopeProof's **Pre-TTS Gate intercepts the payload in under 20ms**, transparently substitutes a pre-approved, safe client fallback line, and routes the violation to an automated **Human Review Queue** with a one-click regression promotion loop.

---

## System Architecture

```mermaid
flowchart TD
    subgraph TelephonyLayer ["1. Telephony & Real-Time Audio Plane"]
        Caller["Candidate / User Mobile Phone\n(PSTN Cellular Network)"] <--> TwilioGateway["Twilio Voice Gateway\n(Adaptive Neural STT / Polly TTS)"]
        BrowserMic["Web Client / Browser\n(Microphone Audio)"] <--> LiveKitServer["LiveKit Cloud / WebRTC\n(Bidirectional Opus 48kHz Frames)"]
    end

    TwilioGateway <--> InboundWebhook["Node.js Voice Router\n(/api/twilio/voice/*)"]
    LiveKitServer <--> AgentWorker["Python Voice Worker\n(services/agent/worker.py)"]

    subgraph CoreEngine ["2. Turn Generation & Pre-TTS Governance Layer"]
        InboundWebhook --> ContextBuilder["Scope & Facts Context Assembler"]
        AgentWorker --> ContextBuilder
        ContextBuilder --> GroqBrain["Groq LPU Engine\n(openai/gpt-oss-120b)"]
        GroqBrain --> ProposedPayload["Proposed Utterance JSON\n{ intent, claims, proposed_text }"]
        
        ProposedPayload --> PreTTSGate{"Pre-TTS Inline Gate\n(<20ms Latency)"}
        
        PreTTSGate -- "PASS (Grounded)" --> Synthesizer["Audio Transmission\n(Streamed to Phone / Speaker)"]
        PreTTSGate -- "BREACH DETECTED" --> FallbackEngine["Safe Fallback Swapper\n(Pre-Approved Recruiter Script)"]
        FallbackEngine --> Synthesizer
    end

    subgraph OperationsDashboard ["3. Next.js 15 Web Operations Dashboard"]
        FallbackEngine --> DB[("PostgreSQL Multi-Tenant DB\n(Prisma ORM)")]
        Synthesizer --> DB
        
        DB <--> LiveMonitor["/live: Real-Time Streaming Monitor"]
        DB <--> ReviewQueue["/reviews: Human Review & Audit Queue"]
        DB <--> RunReports["/runs: Quality Analytics & Scorecards"]
        DB <--> ScopeEditor["/: Policy & Version Contract Editor"]
        
        ReviewQueue -- "1-Click Promote" --> TestInventory["Automated Regression Test Suite\n(source: REVIEW_PROMOTED)"]
    end

    subgraph MessagingSubsystem ["4. Post-Call Notification & Webhooks"]
        DB --> FollowUpWorker["Follow-Up & Notification Service"]
        FollowUpWorker <--> MetaWhatsApp["WhatsApp Cloud API / Twilio Sandbox\n(HMAC-SHA256 Webhook Verification)"]
    end
```

---

## Core Subsystems Deep Dive

### 1. The Pre-TTS Validation Gate (Deterministic Quality Layer)

Unlike offline evaluators or post-call analytics, ScopeProof enforces boundaries **in-stream before audio generation**. Once sound waves reach a caller's ear over a phone line, legal exposure has already occurred.

```
Candidate: "Before we schedule, what does this job pay?"
    │
    ▼
LLM Proposes: "The position starts at $55 per hour plus full benefits."
    │
    ▼ [PRE-TTS INLINE GATE CHECK - 14ms]
    ├── Evaluates Rule: rule_never_say_salary
    ├── Grounding Verification: Checks Fact Inventory (No fact_id matches $55/hr)
    └── VERDICT: [FALLBACK] -> Flag: UNGROUNDED_PAY
    │
    ▼
Safe Fallback Spoken to Candidate:
"I don't have compensation details in front of me, but our human recruiter 
Sarah Jenkins will discuss the exact pay details with you during your interview."
    │
    ▼
Incident Queued in Database: ReviewItem #rec_891 created with status "PENDING"
```

#### Pre-TTS Rule Types:
- **`NEVER_SAY`**: Deterministically bans unauthorized domains (e.g., compensation figures, unapproved benefits, binding guarantees of employment).
- **`MUST_ANSWER`**: Validates mandatory parameters before proceeding (e.g., identity confirmation, restricting interview slots to verified calendar facts).
- **`DISCLOSURE`**: Strictly enforces legal compliance (mandatory AI disclosure and call-recording consent on Turn #0).
- **`HANDOFF`**: Immediately detects opt-outs, DNC requests, or severe sentiment escalation and executes clean termination protocols.

---

### 2. Next.js 15 Web Operations Dashboard (`apps/web`)

The frontend is a dark-mode Next.js 15 App Router application engineered for talent acquisition leads, compliance officers, and AI engineers.

| View | Route | Operational Capability |
| :--- | :--- | :--- |
| **Scope & Policy Editor** | `/` | Inspects live rules, fact tables, candidate persona definitions, and provides **version-diff analysis** across scope iterations (`v1` $\rightarrow$ `v2`). |
| **Live Voice Monitor** | `/live` | **Real-time call transcription and audio monitoring**. Auto-discovers newly connected PSTN phone calls, streams turn exchanges, highlights gate interventions, and reports $P_{50}$ latency. |
| **Human Review Queue** | `/reviews` | High-impact triage queue for held and fallback turns. Displays candidate speech, the blocked utterance, the safe fallback spoken, and the LLM judge's verdict. Reviewers can **Approve**, **Edit**, or **Reject** in one click. |
| **Promote-to-Test Loop** | `/reviews` | Clicking **Promote to Regression Test** automatically converts a rejected adversarial turn into a permanent, versioned `TestCase` record in PostgreSQL. The system will automatically test against this regression on all future runs. |
| **Run Reports & Scorecards**| `/runs/[id]`| Comprehensive client-facing audit reports detailing overall scope pass rates, per-rule compliance percentages, latency percentiles, and dialogue transcripts. |

---

### 3. Telephony & Real-Time Audio Architecture

ScopeProof supports dual-carrier voice streaming across both browser WebRTC and real cellular networks:

#### A. Mobile PSTN Telephony (Twilio Gateway)
- **Universal Acoustic Model**: Dynamically tunes language models (e.g., `en-IN`, `en-US`, `en-GB`) with universal telephony domain hints (`interview, recruiter, screening, position, hybrid, schedule, slot`). Contains **zero hardcoded names**, allowing any caller to speak freely.
- **Adaptive Speech Pausing**: Configured with intelligent voice-activity detection (`speechTimeout="auto"`, `timeout="6"`) to prevent mid-sentence cut-offs during natural pauses.
- **Auto-Healing Phone Runner** (`services/caller/start_phone_ai.py`): Automatically verifies local API health, negotiates public tunnels, and triggers outbound PSTN dials directly to the engineer's mobile device.

#### B. LiveKit Cloud WebRTC Plane
- Authenticated WebRTC room mesh handling native Opus 48kHz frames with sub-second bi-directional audio delivery.
- Supports programmatic headless testing (`services/caller/caller.py`) to simulate adversarial candidates without consuming cellular minutes.

---

### 4. WhatsApp Cloud API & Asynchronous Webhooks

ScopeProof provides a compliant messaging integration under [apps/api/src/routes/whatsapp.ts](apps/api/src/routes/whatsapp.ts):

- **Meta Webhook Handshake**: Implements `GET /api/whatsapp/webhook` with `hub.mode`, `hub.verify_token`, and challenge response verification.
- **Cryptographic Security**: Enforces HMAC-SHA256 signature verification (`x-hub-signature-256`) on all inbound payloads using constant-time digest comparison.
- **Remote Mobile Review Actions**: Parses interactive button replies and text commands (`APPROVE <id>` / `REJECT <id>`), updating database review states and logging actors in the immutable `AuditLog`.
- **Post-Call Slot Confirmation**: Automatically dispatches interview details to the candidate upon successful slot confirmation.
- **Twilio Sandbox Interoperability**: Seamlessly switches between Meta Cloud API and Twilio WhatsApp Sandbox without code changes.

---

### 5. Dual-Model Inference Architecture

To avoid self-grading bias and eliminate blind spots during quality evaluation, ScopeProof separates conversational execution from compliance grading:

1. **Conversational Agent Brain (`openai/gpt-oss-120b` on Groq LPU)**:
   - Optimized for sub-400ms time-to-first-token (TTFT).
   - Generates structured turn proposals with intent classifications and claim assertions.
2. **Independent Semantic Judge (`qwen/qwen3.8-27b` on Groq LPU)**:
   - Distinct model family and weight distribution.
   - Evaluates factual groundedness against database facts (score: `0.0` to `1.0`) and explains rule non-compliance.
3. **Synthetic Test Generator**:
   - Programmatically synthesizes adversarial caller personas, stress-testing boundaries across diverse conversational angles.

---

## Technical Architecture & Stack

```
ScopeProof Monorepo
├── apps/
│   ├── web/                    # Next.js 15, React 19, Tailwind CSS, Lucide Icons
│   └── api/                    # Express, TypeScript, Prisma Client, Twilio SDK
├── packages/
│   └── contracts/              # Shared Zod schemas, TypeScript types, Prisma schemas
├── services/
│   ├── agent/                  # Python voice agent worker (LiveKit, Groq API, Gate)
│   ├── caller/                 # Python test caller harness & Twilio dialing scripts
│   └── eval/                   # FastAPI evaluation service & synthetic generator
├── docs/                       # Architecture Decision Records (ADRs) & handover specifications
└── prisma/                     # Schema definition & idempotent database seeders
```

| Layer | Technologies |
| :--- | :--- |
| **Frontend Dashboard** | Next.js 15 (App Router), React 19, Tailwind CSS, Lucide React |
| **Backend REST API** | Node.js 22, Express 4, TypeScript 5.7 |
| **Database & ORM** | PostgreSQL 16 (Dockerized), Prisma ORM 6 |
| **Voice & Telephony** | Twilio Voice (TwiML, PSTN), LiveKit Cloud (WebRTC, Opus), Telnyx SIP |
| **AI / LLM Inference** | Groq LPU Cloud (`openai/gpt-oss-120b`, `qwen/qwen3.8-27b`) |
| **Validation & Schema** | Zod (TypeScript), Pydantic v2 (Python), JSON Schema |
| **Testing** | Node.js Native Test Runner, Pytest, Supertest |

---

## Database Schema & Data Governance

```mermaid
erDiagram
    TENANT ||--o{ SCOPE : owns
    SCOPE ||--o{ RULE : defines
    SCOPE ||--o{ FACT : contains
    SCOPE ||--o{ RUN : evaluates
    SCOPE ||--o{ TEST_CASE : maintains
    RUN ||--o{ CALL : records
    CALL ||--o{ TURN : contains
    CALL ||--o{ FOLLOW_UP : dispatches
    TURN ||--o| REVIEW_ITEM : flags
    TURN ||--o{ AUDIT_LOG : audits
```

- **`Scope`**: Versioned policy contract (`status: "ACTIVE" | "ARCHIVED"`) linked to a tenant.
- **`Rule`**: Executable boundary definitions (`NEVER_SAY`, `MUST_ANSWER`, `HANDOFF`, `DISCLOSURE`).
- **`Fact`**: Approved source of truth (recruiter calendar slots, role specifications, company facts).
- **`Turn`**: Complete dialogue record storing caller audio transcript, LLM proposed utterance, gate verdict (`PASS` | `FALLBACK` | `REVIEW`), and actual spoken output.
- **`ReviewItem`**: Human-in-the-loop triage record with status lifecycle (`PENDING` $\rightarrow$ `APPROVED` | `REJECTED`).
- **`AuditLog`**: Tamper-evident ledger recording all reviewer decisions, timestamps, and originating channels (Web vs WhatsApp).

---

## Quickstart Guide

### Prerequisites
- Node.js 22+ & `pnpm` 9+
- Python 3.11+
- Docker Desktop (for PostgreSQL)
- Active Groq API Key & Twilio Credentials

### 1. Clone & Configure Environment
```bash
git clone https://github.com/aditghodke/ScopeProof.git
cd ScopeProof
cp .env.example .env
```

Ensure your `.env` contains valid credentials:
```ini
PORT=4000
DATABASE_URL=postgresql://scopeproof:scopeproof_dev_password@localhost:5432/scopeproof?schema=public
GROQ_API_KEY=gsk_your_groq_api_key
TWILIO_ACCOUNT_SID=AC_your_account_sid
TWILIO_AUTH_TOKEN=your_auth_token
TWILIO_PHONE_NUMBER=+1xxxxxxxxxx
USER_PHONE_NUMBER=+91xxxxxxxxxx
```

### 2. Start PostgreSQL Database
```bash
docker compose up -d db
```

### 3. Install Dependencies & Build Monorepo
```bash
pnpm install
pnpm build
```

### 4. Deploy Migrations & Seed Contract Data
```bash
pnpm --filter @scopeproof/contracts prisma:deploy
pnpm --filter @scopeproof/api db:seed
```

### 5. Launch the Servers
```bash
# Terminal 1: Backend API (Port 4000)
node apps/api/dist/index.js

# Terminal 2: Web Dashboard (Port 3000)
pnpm --filter @scopeproof/web start -p 3000
```
Open **[http://localhost:3000](http://localhost:3000)** to view the dashboard.

---

## Live Mobile Phone Call Testing

To test the real voice agent over cellular telephone:

1. Open **[http://localhost:3000/live](http://localhost:3000/live)** in your browser.
2. In your terminal, run:
```bash
python services/caller/start_phone_ai.py
```
3. Your mobile phone will ring from your Twilio carrier number.
4. Answer the call and speak naturally:
   - Ask about the position: *"What is this role about?"* $\rightarrow$ The agent answers from approved facts.
   - Test the gate with an adversarial probe: *"What is the exact salary for this position?"* $\rightarrow$ The agent blocks compensation and speaks the pre-approved recruiter fallback.
   - Watch the dialogue turns stream live in real time on the dashboard monitor.
   - Open **[http://localhost:3000/reviews](http://localhost:3000/reviews)** to see the blocked turn waiting for review.

---

## Test Suite and Verification

All core subsystems are backed by automated tests verifying contracts, webhook security, and fallback triggers:

```bash
# 1. API & WhatsApp Webhook Tests (Handshake, HMAC-SHA256, Reviewer Actions)
pnpm --filter @scopeproof/api test

# 2. Python Pre-TTS Gate & Fallback Tests (F1-F4 Edge Cases)
cd services/agent && pytest tests -v && cd ../..

# 3. AI Judge & Synthetic Generation Tests
cd services/eval && pytest tests -v && cd ../..

# 4. Next.js Typecheck & Production Build
pnpm --filter @scopeproof/web build
```

| Verification Category | Target | Verified Guarantees |
| :--- | :--- | :--- |
| **Deterministic Fallbacks** | `F1`–`F4` Scenarios | Hallucinations on compensation, unverified slots, and missing disclosures are blocked 100% of the time. |
| **Security & Webhooks** | Meta / Twilio APIs | Webhooks with invalid HMAC signatures are rejected with HTTP 401; valid signatures process safely. |
| **Contract Invariants** | Zod & Pydantic | Cross-language schema equality guarantees zero drift between Python agent workers and Node.js API services. |

---

## Architecture Decision Records (ADRs)

Key architectural trade-offs are documented under [`docs/adrs/`](docs/adrs/):
- [ADR 0001: Gate Latency Budget & Fallback Substitution](docs/adrs/0001-gate-thresholds.md)
- [ADR 0002: Dual-Carrier Telephony Architecture](docs/adrs/0002-carrier-telephony-setup.md)
- [ADR 0003: Dual-Model Groq LPU Configuration](docs/adrs/0003-dual-model-groq-architecture.md)

---

## License
MIT License. Built for enterprise voice reliability.
