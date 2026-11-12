import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { Server } from "node:http";
import { app } from "../index.js";
import { prisma } from "../prisma.js";
import { config } from "../config.js";

let server: Server;
let baseUrl: string;

before(async () => {
  await new Promise<void>((resolve) => {
    server = app.listen(0, () => {
      const addr = server.address();
      if (addr && typeof addr === "object") {
        baseUrl = `http://127.0.0.1:${addr.port}`;
      }
      resolve();
    });
  });
});

after(async () => {
  await new Promise<void>((resolve) => {
    server.close(() => resolve());
  });
});

test("6.1 Webhook verification handshake (GET): returns challenge on valid token", async () => {
  const challenge = "test_challenge_12345";
  const token = config.WHATSAPP_VERIFY_TOKEN || "scopeproof_webhook_verify_token";

  const res = await fetch(
    `${baseUrl}/api/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=${token}&hub.challenge=${challenge}`
  );

  assert.equal(res.status, 200);
  const text = await res.text();
  assert.equal(text, challenge);
});

test("6.1 Webhook verification handshake (GET): rejects invalid verify_token with 403", async () => {
  const res = await fetch(
    `${baseUrl}/api/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=wrong_token&hub.challenge=test_123`
  );

  assert.equal(res.status, 403);
});

test("6.2 Webhook signature validation (POST): rejects invalid signature with 401", async () => {
  const body = { test: "data" };

  const res = await fetch(`${baseUrl}/api/whatsapp/webhook`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-hub-signature-256": "sha256=invalid_signature_hex_digest"
    },
    body: JSON.stringify(body)
  });

  assert.equal(res.status, 401);
  const json = (await res.json()) as { error?: string };
  assert.equal(json.error, "Invalid signature");
});

test("6.2 Webhook signature validation (POST): accepts valid HMAC-SHA256 signature", async () => {
  const body = JSON.stringify({
    object: "whatsapp_business_account",
    entry: []
  });

  const appSecret = config.WHATSAPP_APP_SECRET || config.WHATSAPP_TOKEN || "scopeproof_secret";
  const hmac = crypto.createHmac("sha256", appSecret);
  const validSig = `sha256=${hmac.update(body).digest("hex")}`;

  const res = await fetch(`${baseUrl}/api/whatsapp/webhook`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-hub-signature-256": validSig
    },
    body
  });

  assert.equal(res.status, 200);
});

test("6.4 Reviewer quick-reply command via WhatsApp webhook: updates ReviewItem status and logs audit", async () => {
  // Create a pending review item in database
  const scope = await prisma.scope.findFirst({ where: { status: "ACTIVE" } });
  assert.ok(scope, "Active scope exists");

  const run = await prisma.run.create({
    data: {
      scopeId: scope.id,
      promptVersion: "v1.0-whatsapp-test",
      model: "test-model"
    }
  });

  const call = await prisma.call.create({
    data: {
      runId: run.id,
      carrier: "TELNYX",
      livekitRoom: `room-wa-test-${Date.now()}`
    }
  });

  const turn = await prisma.turn.create({
    data: {
      callId: call.id,
      idx: 1,
      callerText: "What is the pay rate?",
      proposed: { proposed_utterance: "The pay is $45 an hour." },
      spoken: "Let me check with the hiring manager on compensation details.",
      gate: "REVIEW",
      flags: ["UNGROUNDED_PAY"]
    }
  });

  const reviewItem = await prisma.reviewItem.create({
    data: {
      turnId: turn.id,
      status: "PENDING"
    }
  });

  // Send WhatsApp message webhook with command "APPROVE <id>"
  const webhookBody = {
    Body: `APPROVE ${reviewItem.id}`,
    From: "whatsapp:+15551234567",
    AccountSid: "ACtest"
  };

  const res = await fetch(`${baseUrl}/api/whatsapp/webhook`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(webhookBody)
  });

  assert.equal(res.status, 200);

  // Verify ReviewItem status updated to APPROVED in DB
  const updated = await prisma.reviewItem.findUnique({
    where: { id: reviewItem.id }
  });
  assert.equal(updated?.status, "APPROVED");
  assert.ok(updated?.decidedBy?.includes("WhatsApp Reviewer"));

  // Verify AuditLog entry was created
  const audit = await prisma.auditLog.findFirst({
    where: {
      action: "REVIEW_DECISION",
      payload: {
        path: ["reviewId"],
        equals: reviewItem.id
      }
    }
  });
  assert.ok(audit, "Audit log entry created for WhatsApp decision");
});

test("6.3 Utility-template follow-up after call end: creates FollowUp in database", async () => {
  const call = await prisma.call.findFirst({
    orderBy: { createdAt: "desc" }
  });
  assert.ok(call, "Call exists");

  const res = await fetch(`${baseUrl}/api/whatsapp/send-followup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      callId: call.id,
      recipientPhone: "+15551234567",
      slot: "Tuesday at 10:00 AM EST"
    })
  });

  assert.equal(res.status, 200);
  const json = (await res.json()) as { success: boolean; followUp: { id: string; status: string; template: string } };
  assert.equal(json.success, true);
  assert.equal(json.followUp.template, "utility_interview_confirm");
  assert.equal(json.followUp.status, "SENT");

  // Verify in Prisma
  const dbFollowUp = await prisma.followUp.findUnique({
    where: { id: json.followUp.id }
  });
  assert.ok(dbFollowUp);
  assert.equal(dbFollowUp?.callId, call.id);
});
