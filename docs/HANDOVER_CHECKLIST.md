# Production Handover & Deployment Checklist

This checklist must be executed and signed off before graduating ScopeProof from development to client production deployments.

---

## 1. Environment & Infrastructure

- [x] **PostgreSQL Database**:
  - Container `scopeproof_db` (`postgres:16-alpine`) running healthy on port `5432`.
  - Schema migrations applied (`Prisma Migrate` / `db push`).
  - Indexes verified on `Turn(callId, idx)`, `ReviewItem(status)`, `Call(runId)`.
- [x] **Groq LLM Acceleration**:
  - API Key verified active on Groq Cloud.
  - Agent Model: `openai/gpt-oss-120b` (low TTFT, ~400ms).
  - Judge / Generator Model: `qwen/qwen3.8-27b`.
- [x] **LiveKit Cloud WebRTC**:
  - WebRTC WebSocket URL configured (`wss://scopeproof-vmdy7fhy.livekit.cloud`).
  - Agent and caller connect with valid token generation.
- [x] **Telephony Carriers**:
  - Telnyx SIP Trunk `ScopeProof` (ID: `3081264641976829632`) active.
  - Twilio Voice & WhatsApp account configured.

---

## 2. Security & Compliance Controls

- [x] **Mandatory First-Turn Disclosure**:
  - Turn #0 explicitly identifies AI agent identity and recording policy.
  - Regression tested in `test_gate.py` and `scopes.test.ts`.
- [x] **Zero-Exposure Salary Guarantee**:
  - Pre-TTS gate prevents any audio transmission of ungrounded dollar figures.
  - Verified with live adversarial calls.
- [x] **Webhook Signature Verification**:
  - Meta `x-hub-signature-256` HMAC-SHA256 enforced.
  - Unauthorized payloads rejected with HTTP 401.
- [x] **Audit Trail Completeness**:
  - All reviewer decisions (Approve, Edit, Reject, Promote) logged in `AuditLog` table with timestamp, actor, and payload.

---

## 3. Operations & Maintenance

- [x] **Node.js Express API**:
  - Running on `http://localhost:4000`.
  - Health check endpoint `GET /health` returns HTTP 200 `{ status: "ok" }`.
- [x] **Next.js 15 Web Application**:
  - Running on `http://localhost:3000`.
  - Production build compiled with zero TypeScript or ESLint errors.
  - All 5 routes operational: `/`, `/reviews`, `/runs`, `/runs/[id]`, `/live`.
- [x] **Automated Regression Suite**:
  - Run command: `pnpm test` (passes 100%).
  - Python tests: `pytest services/agent/tests` and `pytest services/eval/tests` (pass 100%).

---

## 4. Operational Sign-Off
- **Platform Engineer**: Verified
- **QA Automation Lead**: Verified
- **Date**: October 29, 2026

