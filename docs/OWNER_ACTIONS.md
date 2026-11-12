# Owner Actions & Production Credentials

This document outlines the external services and credentials utilized across ScopeProof, distinguishing between the active zero-friction development/demo setup and optional enterprise production additions.

---

## 1. Active & Configured Credentials (Current System)

All services below are fully configured in `.env` and active:

- [x] **Groq Cloud API Key (`GROQ_API_KEY`)**
  - Ultra-low latency LPU inference engine powering the agent conversation (`openai/gpt-oss-120b`) and cross-architecture evaluation (`qwen/qwen3.8-27b`).
- [x] **LiveKit Cloud Credentials (`LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`)**
  - Powers real-time WebRTC audio rooms, bidirectional Opus audio streaming, and participant state management.
- [x] **Twilio Carrier (`TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER`)**
  - Powers PSTN telephone calls directly to real mobile phones via dynamic TwiML webhooks and neural speech recognition.
  - Supports WhatsApp testing via Twilio Sandbox.
- [x] **Telnyx SIP Trunking (`TELNYX_API_KEY`, `TELNYX_SIP_TRUNK_ID`)**
  - SIP connection configured for automated programmatic test calling and carrier fallback.
- [x] **Docker PostgreSQL (`DATABASE_URL`)**
  - Local multi-tenant database for scopes, rules, facts, test cases, call logs, turn transcripts, and human review items.

---

## 2. Telephony & Messaging Setup

- **Live PSTN Calling**:
  - Outbound dialing to any verified phone number using `services/caller/start_phone_ai.py`.
  - Inbound webhook handling via `/api/twilio/voice/incoming` with universal acoustic speech recognition (works across Indian, US, UK, and international accents).
- **Post-Call Notifications & Review Alerts**:
  - The API exposes full Meta-compliant webhook verification and HMAC-SHA256 signature checking (`/api/whatsapp/webhook`).
  - Human review approvals and rejections can be performed via the Web Dashboard at `/reviews` or remotely via webhook commands.

---

## 3. Optional Enterprise Production Additions

These are strictly optional when transitioning from portfolio demo to large-scale enterprise production:

- **Meta Business Verification (WhatsApp Cloud API)**:
  - If a client requires direct Meta Cloud API messaging rather than Twilio/SMS routing, register a Meta Business Manager account at `business.facebook.com` and submit custom utility message templates for approval.
- **Enterprise Indian DLT / TRAI A2P**:
  - Commercial domestic Indian outbound campaigns require DLT registration. Not required for development or direct portfolio demonstrations.
