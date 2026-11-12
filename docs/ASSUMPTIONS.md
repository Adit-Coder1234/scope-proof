# Assumptions and Unverified Items

## Assumptions

| # | Assumption | Basis | Risk if wrong |
|---|-----------|-------|---------------|
| A1 | Microsive's "where the agent stops" agreement is not currently machine-checked | Inferred from their public site describing pre-launch agreement but no stated repeatable method | Low — ScopeProof is independently useful regardless |
| A2 | ScopeProof does NOT duplicate Voice WFM (multi-client ops, pacing, cost) | Prompt constraint; Voice WFM already covers those | ScopeProof is the quality layer beside it |
| A3 | The demo domain (interview-slot confirmation for a staffing agency) is relevant to Microsive | They list recruitment and staffing among their served industries | Low |
| A4 | PostgreSQL runs in Docker on the dev machine | No native psql found; Docker 29.4.3 is available | Need to confirm Docker Desktop is running |
| A5 | pnpm 10.27.0 workspace protocol is used for the monorepo | pnpm is installed; yarn is not | Need to verify workspace config syntax for this version |
| A6 | Python 3.14 is compatible with livekit-agents, groq, fastapi, pydantic packages | These packages may not yet have wheels for 3.14 | May need to use a different Python version via uv |
| A7 | All recruiter calendars, facts, and candidates are seed data labelled MOCK | Per prompt requirement | None |
| A8 | No cost figures are stated anywhere | Per prompt: "No verified cost figure exists. Do not invent one." | None |
| A9 | Dual distinct model architectures on Groq prevent self-grading bias and hallucination loops | Meta's `llama-3.3-70b-versatile` powers agent turns; Mistral AI's `mixtral-8x7b-32768` powers cross-evaluation judging and test generation. One API key, independent evaluation lineages. | None |

## Unverified items

| # | Item | Status | Action needed |
|---|------|--------|---------------|
| U1 | Plivo India number availability and KYC timing | UNVERIFIED | Owner must complete Plivo KYC; Telnyx is fallback |
| U2 | TRAI/DLT current requirements | UNVERIFIED — rules were changing (third amendment reported Oct 2026) | "Verify current TRAI/DLT requirements with the client before any real campaign" |
| U3 | Latency targets | UNMEASURED until real calls produce data | Will be filled from run reports |
| U4 | Gate threshold values (0.8 hold, 0.5 block) | Starting values, UNVERIFIED | Tune on test data, record in ADR |
| U5 | WhatsApp template approval timing | UNVERIFIED | Depends on Meta review |
| U6 | LiveKit Agents Python SDK API surface for v current | UNVERIFIED until installed and inspected | Verify in P4 before writing agent code |
| U7 | Groq structured output API and model JSON mode support | UNVERIFIED until tested against live API in P3 | Verify in P3 before writing turn code |
| U8 | Groq judge prompt sensitivity | UNVERIFIED | Evaluate in P3 eval service |
| U9 | Python 3.14 compatibility with key packages | UNVERIFIED | Test in P1; fall back to 3.12/3.13 via uv if needed |
| U10 | Microsive LinkedIn content | NOT RETRIEVED (blocked) | No claims made |
| U11 | WhatsApp Cloud API Graph API version and payload shapes | UNVERIFIED until verified from Meta docs in P6 | Verify in P6 |
| U12 | Per-language voice agent accuracy | UNMEASURED | Language is a test parameter; accuracy comes from runs |

## Mocks

| Label | What | Where used |
|-------|------|-----------|
| MOCK: Recruiter calendar | Seed data with available interview slots | Fact table, rule engine |
| MOCK: Knowledge facts | Company info, role details, process steps | Fact table |
| MOCK: Candidates | Test candidate profiles | TestCase personas |

All mocks are labelled with "MOCK:" in code and UI.
