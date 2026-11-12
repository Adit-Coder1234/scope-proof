# ADR 0002: Carrier and Telephony Setup

## Status
Accepted

## Context
Voice agents require telephony connectivity to bridge WebRTC audio streams with public PSTN telephone networks. The system needed:
1. High-fidelity audio streaming with real-time bidirectional frame processing.
2. Low infrastructure cost during evaluation and development (zero-cost constraint).
3. Carrier fallback support (WebRTC, Telnyx SIP Trunking, Twilio PSTN).
4. Reliable post-call notification delivery (WhatsApp & SMS).

## Decision

### 1. Audio Runtime: LiveKit Cloud (WebRTC)
- **Role**: Primary real-time audio plane.
- **Protocol**: WebRTC with Opus audio encoding (48kHz sample rate, 20ms frame chunks).
- **Architecture**:
  - `services/agent/worker.py` connects as an authenticated participant (`livekit.rtc`), publishing native audio tracks (`AudioSource` + `LocalAudioTrack`).
  - `services/caller/caller.py` simulates candidates and test calls connecting as a distinct room participant, streaming mic input and receiving agent audio.
- **Cost**: LiveKit Cloud free tier (10,000 monthly minutes, 0 credit card friction).

### 2. PSTN & Carrier Trunking: Telnyx + Twilio
- **Telnyx**:
  - Configured SIP Connection `ScopeProof` (ID: `3081264641976829632`).
  - Handles SIP trunking and inbound call routing without requiring paid dedicated phone numbers.
- **Twilio**:
  - Configured Twilio Free Trial carrier (Account SID `AC_MOCK_TWILIO_ACCOUNT_SID`).
  - Active caller ID / SMS / WhatsApp testing with assigned phone number and verified destination.
  - Enables real voice calls (75 free minutes) and WhatsApp follow-up messages (100 free messages).

### 3. Failover Strategy
- If PSTN SIP trunking is unavailable or un-provisioned, all test calls and client evaluation runs execute over LiveKit WebRTC rooms (`scopeproof-happy_path-...`, `scopeproof-salary_adversarial-...`).
- If WhatsApp delivery is unlinked, notifications automatically fallback to SMS on verified numbers.

## Consequences
- 100% functional end-to-end voice testing with zero financial cost.
- True WebRTC audio tracks with sub-second transmission.
- Seamless graduation path to enterprise SIP trunks when deploying into production.

