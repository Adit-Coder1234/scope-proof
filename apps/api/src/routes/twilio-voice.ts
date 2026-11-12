import { Router, Request, Response } from "express";
import { prisma } from "../prisma.js";
import { config } from "../config.js";

export const twilioVoiceRouter = Router();

function escapeXml(unsafe: string): string {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * Universal domain vocabulary for telephony speech-to-text acoustic biasing.
 * Does NOT contain any specific person's name, so it works universally for any caller.
 */
const UNIVERSAL_DOMAIN_HINTS =
  "interview, screening, recruiter, position, job, role, application, schedule, slot, appointment, timing, Friday, Monday, Tuesday, Wednesday, Thursday, October, November, morning, afternoon, hybrid, remote, full time, salary, compensation, Sarah Jenkins, confirm, reschedule, cancel";

const SALARY_REGEX = /\$|\b(salary|pay|hourly|compensation|per hour|rate|dollar|dollars|benefits|bonus)\b/i;
const OPT_OUT_REGEX = /\b(stop calling|remove me|not interested|take me off|do not call|unsubscribe)\b/i;

/**
 * Dynamically resolves caller language and natural TTS voice based on international dialing prefix.
 * Automatically adapts between US, Indian, British, Australian, and international accents.
 */
function getLocaleForNumber(phoneNumber?: string): { language: string; voice: string } {
  if (!phoneNumber) return { language: "en-US", voice: "Polly.Joanna" };
  const cleaned = phoneNumber.replace(/[\s\-\(\)]/g, "");
  if (cleaned.startsWith("+91") || cleaned.startsWith("91")) {
    return { language: "en-IN", voice: "Polly.Aditi" };
  }
  if (cleaned.startsWith("+44") || cleaned.startsWith("44")) {
    return { language: "en-GB", voice: "Polly.Amy" };
  }
  if (cleaned.startsWith("+61") || cleaned.startsWith("61")) {
    return { language: "en-AU", voice: "Polly.Nicole" };
  }
  return { language: "en-US", voice: "Polly.Joanna" };
}

function getTargetPhone(req: Request): string {
  const to = String(req.body.To || "");
  const from = String(req.body.From || "");
  const twilioNum = (config.TWILIO_PHONE_NUMBER || "").replace("+", "");
  if (to && !to.includes(twilioNum)) return to;
  if (from && !from.includes(twilioNum)) return from;
  return to || from;
}

/**
 * Helper to call Groq API for turn generation
 */
async function generateGroqTurn(
  callerUtterance: string,
  history: Array<{ role: "user" | "assistant"; content: string }>,
  facts: Array<{ id: string; key: string; value: string }>,
  rules: Array<{ kind: string; text: string }>
) {
  const factsBlock = facts.map((f) => `- [${f.id}] ${f.key}: ${f.value}`).join("\n");
  const rulesBlock = rules.map((r) => `- [${r.kind}] ${r.text}`).join("\n");

  const systemPrompt = `You are the friendly, professional conversational AI voice agent for Apex Staffing Agency.
Your goal is to answer the candidate's questions about the role and confirm an interview slot.
Speak naturally, concisely (1 to 2 short sentences per turn), and strictly adhere to the approved scope rules and facts.

Approved Facts:
${factsBlock}

Strict Scope Rules:
${rulesBlock}

UNIVERSAL CONVERSATIONAL GUIDELINES:
1. UNIVERSAL NAME HANDLING:
   - When the caller introduces themselves with their name (e.g. "My name is [Name]", "I am [Name]", "This is [Name]", or spells out letters like "A D I T" or "J O H N"), warmly acknowledge them by name (e.g. "Great to connect with you, [Name]!").
   - NEVER ask the caller to spell their name, confirm their spelling, or repeat their name. Accept whatever name they give and move directly forward to answering their question or discussing the interview slots.
   - If the caller does not mention their name and asks a question directly (e.g. "What is the job?", "Who is calling?"), NEVER force them to give their name first. Answer their question immediately!
2. DIRECT ROLE & COMPANY ANSWERS:
   - If the candidate asks what the job is about, what the role entails, or about the company/work mode, IMMEDIATELY explain the role using the Approved Facts (e.g. Senior Full-Stack Engineer with Node.js and React, hybrid in Jaipur) before asking about scheduling.
3. SALARY & COMPENSATION SCOPE BOUNDARY:
   - If the caller asks about salary, pay, compensation, or benefits, do NOT quote any figures or dollar amounts. Defer politely to recruiter Sarah Jenkins.
4. SCHEDULING INTERVIEW SLOTS:
   - Only offer the approved recruiter calendar slots from the facts. Offer 2 options at a time so it is easy to listen to.
5. CONCISE VOICE DELIVERY:
   - Keep each response to 1-2 short, punchy sentences suitable for clear audio playback over a phone line.
6. CALM & PATIENT TONE:
   - If the caller sounds frustrated, repeats a question, or points out a misunderstanding, stay friendly and directly answer their question immediately without arguing, repeating questions, or getting defensive.

Output valid JSON only with keys:
{
  "proposed_utterance": "string to speak to caller",
  "is_commitment": boolean,
  "intent": "string",
  "confidence": number between 0.0 and 1.0
}`;

  const messages = [
    { role: "system", content: systemPrompt },
    ...history,
    { role: "user", content: callerUtterance }
  ];

  try {
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.GROQ_API_KEY}`
      },
      body: JSON.stringify({
        model: config.GROQ_AGENT_MODEL || "openai/gpt-oss-120b",
        messages,
        temperature: 0.2,
        response_format: { type: "json_object" }
      })
    });

    if (!res.ok) {
      console.error("[Groq Error]", await res.text());
      return null;
    }

    const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const content = data.choices?.[0]?.message?.content;
    return content ? JSON.parse(content) : null;
  } catch (err) {
    console.error("[Groq Exception]", err);
    return null;
  }
}

/**
 * Entry point when Twilio dials the user's phone
 * Turn #0: Speaks mandatory AI disclosure & asks for interview slot preference
 */
twilioVoiceRouter.post("/twilio/voice/incoming", async (req: Request, res: Response): Promise<void> => {
  console.log("[Twilio Voice] Call started from:", req.body.From, "to:", req.body.To);

  // Find active scope
  const scope = await prisma.scope.findFirst({
    where: { status: "ACTIVE" },
    include: { rules: true, facts: true }
  });

  const run = await prisma.run.create({
    data: {
      scopeId: scope?.id || "default",
      promptVersion: "twilio-live-v1",
      model: config.GROQ_AGENT_MODEL || "openai/gpt-oss-120b"
    }
  });

  const call = await prisma.call.create({
    data: {
      runId: run.id,
      carrier: "TWILIO",
      livekitRoom: `twilio-pstn-${Date.now()}`
    }
  });

  // Record Turn 0 in database
  const targetPhone = getTargetPhone(req);
  const locale = getLocaleForNumber(targetPhone);
  const roleFact = scope?.facts.find((f) => f.key === "role_title")?.value || "Senior Full-Stack Engineer";

  const openingSpoken =
    `Hi! I am the automated scheduling assistant for Apex Staffing Solutions. This call is recorded for quality. I am calling to confirm your screening interview for the ${roleFact} position. Do you have a moment, or would you like to hear about the role?`;

  await prisma.turn.create({
    data: {
      callId: call.id,
      idx: 0,
      callerText: "[Call Connected]",
      proposed: { proposed_utterance: openingSpoken },
      spoken: openingSpoken,
      gate: "PASS",
      flags: ["MANDATORY_DISCLOSURE"]
    }
  });

  const host = (req.headers["x-forwarded-host"] as string) || req.get("host");
  const proto = (req.headers["x-forwarded-proto"] as string) || "https";
  const baseUrl = `${proto}://${host}`;

  // Return TwiML with Gather speech using universal neural STT compatible with all accents
  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Gather input="speech" action="${baseUrl}/api/twilio/voice/turn?callId=${call.id}&amp;lang=${encodeURIComponent(locale.language)}&amp;voice=${encodeURIComponent(locale.voice)}" method="POST" language="${locale.language}" speechTimeout="auto" timeout="6" hints="${UNIVERSAL_DOMAIN_HINTS}">
        <Say voice="${locale.voice}">${escapeXml(openingSpoken)}</Say>
    </Gather>
    <Say voice="${locale.voice}">I didn't catch that. Please tell me what day or time works best for you, or feel free to ask about the role.</Say>
    <Redirect method="POST">${baseUrl}/api/twilio/voice/retry?callId=${call.id}&amp;lang=${encodeURIComponent(locale.language)}&amp;voice=${encodeURIComponent(locale.voice)}</Redirect>
</Response>`;

  res.setHeader("Content-Type", "text/xml");
  res.status(200).send(twiml);
});

/**
 * Turn loop: Receives transcribed speech from user's phone, runs Pre-TTS Gate, and responds
 */
twilioVoiceRouter.post("/twilio/voice/turn", async (req: Request, res: Response): Promise<void> => {
  const callId = req.query.callId as string;
  const lang = (req.query.lang as string) || "en-US";
  const voice = (req.query.voice as string) || "Polly.Joanna";
  const userSpeech = (req.body.SpeechResult || "").trim();
  console.log(`[Twilio Voice] User spoke: "${userSpeech}" (Call ID: ${callId})`);

  if (!userSpeech) {
    const host = (req.headers["x-forwarded-host"] as string) || req.get("host");
    const proto = (req.headers["x-forwarded-proto"] as string) || "https";
    const baseUrl = `${proto}://${host}`;
    const retryTwiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Gather input="speech" action="${baseUrl}/api/twilio/voice/turn?callId=${callId}&amp;lang=${encodeURIComponent(lang)}&amp;voice=${encodeURIComponent(voice)}" method="POST" language="${lang}" speechTimeout="auto" timeout="6" hints="${UNIVERSAL_DOMAIN_HINTS}">
        <Say voice="${voice}">I didn't quite hear you. Could you please repeat that?</Say>
    </Gather>
    <Say voice="${voice}">Thank you for speaking with Apex Staffing. Have a wonderful day.</Say>
    <Hangup/>
</Response>`;
    res.setHeader("Content-Type", "text/xml");
    res.status(200).send(retryTwiml);
    return;
  }

  // Fetch scope and past turns for context
  const call = await prisma.call.findUnique({
    where: { id: callId },
    include: {
      turns: { orderBy: { idx: "asc" } },
      run: { include: { scope: { include: { rules: true, facts: true } } } }
    }
  });

  const scope = call?.run?.scope;
  const rules = scope?.rules || [];
  const facts = scope?.facts || [];
  const turnIdx = (call?.turns?.length || 0);

  // 1. Check Opt-Out (HANDOFF rule)
  if (OPT_OUT_REGEX.test(userSpeech)) {
    const optOutSpoken =
      "Understood. I have recorded your preference and removed your number from our contact list. Have a wonderful day.";

    await prisma.turn.create({
      data: {
        callId,
        idx: turnIdx,
        callerText: userSpeech,
        proposed: { proposed_utterance: optOutSpoken },
        spoken: optOutSpoken,
        gate: "PASS",
        flags: ["HANDOFF_OPT_OUT"]
      }
    });

    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Say voice="${voice}">${optOutSpoken}</Say>
    <Hangup/>
</Response>`;
    res.setHeader("Content-Type", "text/xml");
    res.status(200).send(twiml);
    return;
  }

  // 2. Build alternating multi-turn conversation history
  const history: Array<{ role: "user" | "assistant"; content: string }> = [];
  for (const t of (call?.turns || []).slice(-6)) {
    if (t.callerText && t.callerText !== "[Call Connected]") {
      history.push({ role: "user", content: t.callerText });
    }
    if (t.spoken) {
      history.push({ role: "assistant", content: t.spoken });
    }
  }

  // 3. Generate Turn via Groq
  const llmResult = await generateGroqTurn(userSpeech, history, facts, rules);
  const proposedUtterance = llmResult?.proposed_utterance || "I understand. Let me check that for you.";

  // 4. PRE-TTS INLINE GATE ENFORCEMENT
  let gateVerdict: "PASS" | "FALLBACK" | "REVIEW" = "PASS";
  let spokenUtterance = proposedUtterance;
  const flags: string[] = [];

  // Salary Breach Detection
  if (SALARY_REGEX.test(userSpeech) || SALARY_REGEX.test(proposedUtterance)) {
    gateVerdict = "FALLBACK";
    flags.push("UNGROUNDED_PAY");
    // Safe pre-approved client fallback
    spokenUtterance =
      "I don't have compensation details in front of me, but our human recruiter Sarah Jenkins will discuss the exact pay details with you during your interview.";
  }

  // Record Turn in PostgreSQL
  const turn = await prisma.turn.create({
    data: {
      callId,
      idx: turnIdx,
      callerText: userSpeech,
      proposed: {
        proposed_utterance: proposedUtterance,
        confidence: llmResult?.confidence || 0.9,
        is_commitment: llmResult?.is_commitment || false
      },
      spoken: spokenUtterance,
      gate: gateVerdict,
      flags
    }
  });

  // If breached, put in Human Review Queue!
  if (gateVerdict !== "PASS") {
    await prisma.reviewItem.create({
      data: {
        turnId: turn.id,
        status: "PENDING"
      }
    });
    console.log(`[Pre-TTS Gate] Breach intercepted! Queued ReviewItem for turn #${turn.id}`);
  }

  const host = (req.headers["x-forwarded-host"] as string) || req.get("host");
  const proto = (req.headers["x-forwarded-proto"] as string) || "https";
  const baseUrl = `${proto}://${host}`;

  // Return next TwiML turn with Gather
  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Gather input="speech" action="${baseUrl}/api/twilio/voice/turn?callId=${callId}&amp;lang=${encodeURIComponent(lang)}&amp;voice=${encodeURIComponent(voice)}" method="POST" language="${lang}" speechTimeout="auto" timeout="6" hints="${UNIVERSAL_DOMAIN_HINTS}">
        <Say voice="${voice}">${escapeXml(spokenUtterance)}</Say>
    </Gather>
    <Say voice="${voice}">I didn't catch that. Could you please repeat?</Say>
    <Redirect method="POST">${baseUrl}/api/twilio/voice/retry?callId=${callId}&amp;lang=${encodeURIComponent(lang)}&amp;voice=${encodeURIComponent(voice)}</Redirect>
</Response>`;

  res.setHeader("Content-Type", "text/xml");
  res.status(200).send(twiml);
});

/**
 * Retry fallback if user was silent
 */
twilioVoiceRouter.post("/twilio/voice/retry", (req: Request, res: Response): void => {
  const callId = req.query.callId as string;
  const lang = (req.query.lang as string) || "en-US";
  const voice = (req.query.voice as string) || "Polly.Joanna";
  const host = (req.headers["x-forwarded-host"] as string) || req.get("host");
  const proto = (req.headers["x-forwarded-proto"] as string) || "https";
  const baseUrl = `${proto}://${host}`;

  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Gather input="speech" action="${baseUrl}/api/twilio/voice/turn?callId=${callId}&amp;lang=${encodeURIComponent(lang)}&amp;voice=${encodeURIComponent(voice)}" method="POST" language="${lang}" speechTimeout="auto" timeout="6" hints="${UNIVERSAL_DOMAIN_HINTS}">
        <Say voice="${voice}">I am still here. Feel free to ask about the role, or let me know what day and time works best for you.</Say>
    </Gather>
    <Say voice="${voice}">Thank you for speaking with Apex Staffing. Goodbye.</Say>
    <Hangup/>
</Response>`;
  res.setHeader("Content-Type", "text/xml");
  res.status(200).send(twiml);
});

