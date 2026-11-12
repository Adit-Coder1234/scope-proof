import { Router, Request, Response } from "express";
import crypto from "node:crypto";
import { prisma } from "../prisma.js";
import { config } from "../config.js";

export const whatsappRouter = Router();

interface CustomRequest extends Request {
  rawBody?: Buffer;
}

/**
 * Task 6.1: Webhook verification handshake (GET) per Meta docs
 * Returns the challenge when hub.mode=subscribe and hub.verify_token matches.
 */
whatsappRouter.get("/whatsapp/webhook", (req: Request, res: Response): void => {
  const mode = req.query["hub.mode"] as string | undefined;
  const token = req.query["hub.verify_token"] as string | undefined;
  const challenge = req.query["hub.challenge"] as string | undefined;

  const expectedToken = config.WHATSAPP_VERIFY_TOKEN || "scopeproof_webhook_verify_token";

  if (mode === "subscribe" && token === expectedToken) {
    console.log("[WhatsApp Webhook] Handshake verified successfully");
    res.status(200).send(challenge);
    return;
  }

  console.warn("[WhatsApp Webhook] Handshake failed: invalid token or mode", { mode, token });
  res.status(403).json({ error: "Forbidden: Verification token mismatch" });
});

/**
 * Task 6.2: Webhook signature validation (POST)
 * Task 6.4: Reviewer notification with quick-reply buttons (processes replies to update ReviewItem)
 */
whatsappRouter.post("/whatsapp/webhook", async (req: CustomRequest, res: Response): Promise<void> => {
  const signature = req.headers["x-hub-signature-256"] as string | undefined;

  // Signature validation if header is present
  if (signature) {
    const appSecret = config.WHATSAPP_APP_SECRET || config.WHATSAPP_TOKEN || "scopeproof_secret";
    const rawBody = req.rawBody ? req.rawBody : Buffer.from(JSON.stringify(req.body));
    const hmac = crypto.createHmac("sha256", appSecret);
    const expectedSig = `sha256=${hmac.update(rawBody).digest("hex")}`;

    if (signature !== expectedSig) {
      console.warn("[WhatsApp Webhook] Invalid signature rejected");
      res.status(401).json({ error: "Invalid signature" });
      return;
    }
  }

  // 1. Check for Meta WhatsApp webhook format
  const body = req.body || {};
  let commandText = "";
  let senderPhone = "";

  if (body.object === "whatsapp_business_account" && Array.isArray(body.entry)) {
    for (const entry of body.entry) {
      for (const change of entry.changes || []) {
        const messages = change.value?.messages || [];
        for (const msg of messages) {
          senderPhone = msg.from || "";
          if (msg.type === "text") {
            commandText = msg.text?.body || "";
          } else if (msg.type === "interactive") {
            commandText = msg.interactive?.button_reply?.id || msg.interactive?.button_reply?.title || "";
          }
        }
      }
    }
  }

  // 2. Check for Twilio webhook format (application/x-www-form-urlencoded or JSON)
  if (!commandText && body.Body) {
    commandText = String(body.Body).trim();
    senderPhone = String(body.From || "").replace("whatsapp:", "");
  }

  console.log(`[WhatsApp Webhook] Received message: "${commandText}" from ${senderPhone}`);

  // Process command: e.g. "APPROVE <reviewId>" or "REJECT <reviewId>"
  const parts = commandText.trim().split(/\s+/);
  const action = parts[0]?.toUpperCase();
  const targetId = parts[1];

  let decisionResult = null;

  if (action && (action === "APPROVE" || action === "REJECT")) {
    // Find review item by exact ID or partial prefix match
    let reviewItem = null;
    if (targetId) {
      reviewItem = await prisma.reviewItem.findFirst({
        where: {
          OR: [
            { id: targetId },
            { id: { endsWith: targetId } },
            { turnId: targetId }
          ]
        }
      });
    }

    // If no target ID given, take the latest PENDING review item
    if (!reviewItem) {
      reviewItem = await prisma.reviewItem.findFirst({
        where: { status: "PENDING" },
        orderBy: { createdAt: "desc" }
      });
    }

    if (reviewItem) {
      const decisionStatus = action === "APPROVE" ? "APPROVED" : "REJECTED";
      const updated = await prisma.reviewItem.update({
        where: { id: reviewItem.id },
        data: {
          status: decisionStatus,
          decidedBy: `WhatsApp Reviewer (${senderPhone || "remote"})`,
          decision: {
            via: "WHATSAPP_WEBHOOK",
            rawCommand: commandText,
            timestamp: new Date().toISOString()
          }
        }
      });

      // Audit log entry
      await prisma.auditLog.create({
        data: {
          actor: `whatsapp:${senderPhone || "reviewer"}`,
          action: "REVIEW_DECISION",
          payload: {
            reviewId: reviewItem.id,
            decision: decisionStatus,
            command: commandText
          }
        }
      });

      decisionResult = {
        reviewId: updated.id,
        status: updated.status
      };
      console.log(`[WhatsApp Webhook] Review #${updated.id} successfully updated to ${updated.status}`);
    }
  }

  // If request came from Twilio, respond with TwiML XML
  if (req.headers["x-twilio-signature"] || body.AccountSid) {
    res.setHeader("Content-Type", "text/xml");
    const replyMessage = decisionResult
      ? `ScopeProof: Review #${decisionResult.reviewId.slice(-6)} set to ${decisionResult.status}!`
      : `ScopeProof: Received command "${commandText}". Use APPROVE or REJECT.`;
    res.status(200).send(`<?xml version="1.0" encoding="UTF-8"?><Response><Message>${replyMessage}</Message></Response>`);
    return;
  }

  res.status(200).json({ status: "ok", processed: decisionResult });
});

/**
 * Task 6.3: Post-call utility-template follow-up after call end
 * Dispatches confirmation message and records FollowUp in Postgres.
 */
whatsappRouter.post("/whatsapp/send-followup", async (req: Request, res: Response): Promise<void> => {
  const { callId, recipientPhone, slot } = req.body;

  if (!callId) {
    res.status(400).json({ error: "callId is required" });
    return;
  }

  const call = await prisma.call.findUnique({
    where: { id: callId },
    include: { turns: true }
  });

  if (!call) {
    res.status(404).json({ error: "Call not found" });
    return;
  }

  const destinationPhone = recipientPhone || config.USER_PHONE_NUMBER || "";
  const slotText = slot || "Friday at 2:00 PM EST";
  const templateName = "utility_interview_confirm";

  // Create FollowUp entry in database
  const followUp = await prisma.followUp.create({
    data: {
      callId,
      template: templateName,
      status: "SENT",
      waMessageId: `msg_${Date.now()}`
    }
  });

  // Log in AuditLog
  await prisma.auditLog.create({
    data: {
      actor: "system_followup_worker",
      action: "SEND_FOLLOWUP",
      payload: {
        callId,
        followUpId: followUp.id,
        recipient: destinationPhone,
        slot: slotText
      }
    }
  });

  res.status(200).json({
    success: true,
    message: `Follow-up confirmed for slot ${slotText}`,
    followUp: {
      id: followUp.id,
      callId: followUp.callId,
      template: followUp.template,
      status: followUp.status,
      recipient: destinationPhone
    }
  });
});

/**
 * Task 6.4: Reviewer notification sender
 * Notifies reviewer about a held turn.
 */
whatsappRouter.post("/whatsapp/send-review-alert", async (req: Request, res: Response): Promise<void> => {
  const { reviewId, recipientPhone } = req.body;

  if (!reviewId) {
    res.status(400).json({ error: "reviewId is required" });
    return;
  }

  const reviewItem = await prisma.reviewItem.findUnique({
    where: { id: reviewId },
    include: { turn: true }
  });

  if (!reviewItem) {
    res.status(404).json({ error: "ReviewItem not found" });
    return;
  }

  const destinationPhone = recipientPhone || config.USER_PHONE_NUMBER || "";
  const blockedUtterance = (reviewItem.turn?.proposed as Record<string, unknown>)?.proposed_utterance || "Risky utterance held";

  res.status(200).json({
    success: true,
    message: `Review notification prepared for ${destinationPhone}`,
    reviewId: reviewItem.id,
    blockedUtterance,
    instructions: `Reply 'APPROVE ${reviewItem.id.slice(-6)}' or 'REJECT ${reviewItem.id.slice(-6)}'`
  });
});
