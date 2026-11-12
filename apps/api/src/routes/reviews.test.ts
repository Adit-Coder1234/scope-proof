import { test, before, after } from "node:test";
import * as assert from "node:assert";
import { app } from "../index.js";
import { prisma } from "../prisma.js";
import type { Server } from "node:http";

let server: Server;
let baseUrl: string;

before(async () => {
  server = await new Promise((resolve) => {
    const s = app.listen(0, () => resolve(s));
  });
  const addr = server.address();
  const port = typeof addr === "object" && addr ? addr.port : 0;
  baseUrl = `http://localhost:${port}`;
});

after(async () => {
  await new Promise((resolve) => server.close(resolve));
  await prisma.$disconnect();
});

test("Review & Promote Lifecycle: list reviews, submit decision, and promote to test", async () => {
  // 1. Seed minimal tenant, scope, run, call
  const tenant = await prisma.tenant.create({
    data: { name: "Review Test Agency" }
  });

  const scope = await prisma.scope.create({
    data: {
      tenantId: tenant.id,
      version: 1,
      status: "ACTIVE"
    }
  });

  const run = await prisma.run.create({
    data: {
      scopeId: scope.id,
      promptVersion: "v1.0",
      model: "openai/gpt-oss-120b"
    }
  });

  const call = await prisma.call.create({
    data: {
      runId: run.id,
      livekitRoom: "test-review-room"
    }
  });

  // 2. Create Turn with REVIEW gate
  const turnRes = await fetch(`${baseUrl}/api/calls/${call.id}/turns`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      idx: 0,
      callerText: "Can you guarantee me 50 LPA?",
      proposed: {
        intent: "salary_request",
        claims: [{ claim: "50 LPA", fact_id: "none" }],
        proposed_utterance: "Sure, package is 50 LPA."
      },
      spoken: "I cannot quote salary on this call.",
      gate: "REVIEW",
      judgeScore: 0.3,
      judgeReason: "Ungrounded pay promise",
      flags: ["UNGROUNDED_PAY"]
    })
  });

  assert.strictEqual(turnRes.status, 201);
  const turnData = (await turnRes.json()) as { reviewItem: { id: string } };
  const reviewItemId = turnData.reviewItem?.id;
  assert.ok(reviewItemId);

  // 3. GET /api/reviews - verify item is listed with PENDING status
  const listRes = await fetch(`${baseUrl}/api/reviews?status=PENDING`);
  assert.strictEqual(listRes.status, 200);
  const list = (await listRes.json()) as Array<{ id: string; status: string }>;
  const found = list.find((r) => r.id === reviewItemId);
  assert.ok(found);
  assert.strictEqual(found.status, "PENDING");

  // 4. POST /api/reviews/:id/decision - Submit review decision
  const decisionRes = await fetch(`${baseUrl}/api/reviews/${reviewItemId}/decision`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      decision: "REJECTED",
      notes: "Never discuss ungrounded compensation figures.",
      decidedBy: "Lead Quality Reviewer"
    })
  });

  assert.strictEqual(decisionRes.status, 200);
  const decisionData = (await decisionRes.json()) as { reviewItem: { status: string } };
  assert.strictEqual(decisionData.reviewItem.status, "REJECTED");

  // Verify AuditLog record was created
  const auditEntry = await prisma.auditLog.findFirst({
    where: { action: "REVIEW_DECISION" },
    orderBy: { at: "desc" }
  });
  assert.ok(auditEntry);
  assert.strictEqual(auditEntry.actor, "Lead Quality Reviewer");

  // 5. POST /api/reviews/:id/promote - Task 5.5 Promote-to-test
  const promoteRes = await fetch(`${baseUrl}/api/reviews/${reviewItemId}/promote`, {
    method: "POST"
  });
  assert.strictEqual(promoteRes.status, 201);
  const promoteData = (await promoteRes.json()) as {
    testCase: { id: string; source: string; script: Array<{ content: string }> };
  };
  assert.ok(promoteData.testCase);
  assert.strictEqual(promoteData.testCase.source, "REVIEW_PROMOTED");
  assert.strictEqual(promoteData.testCase.script[0].content, "Can you guarantee me 50 LPA?");

  // Verify promotedCaseId linked on review item
  const updatedReview = await prisma.reviewItem.findUnique({
    where: { id: reviewItemId }
  });
  assert.strictEqual(updatedReview?.promotedCaseId, promoteData.testCase.id);

  // 6. Task 5.6 Scope Diff test
  const bumpRes = await fetch(`${baseUrl}/api/scopes/${scope.id}/version`, {
    method: "POST"
  });
  assert.strictEqual(bumpRes.status, 201);
  const v2Scope = (await bumpRes.json()) as { id: string };
  const v2ScopeId = v2Scope.id;

  // Add a new rule to v2
  await fetch(`${baseUrl}/api/scopes/${v2ScopeId}/rules`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      kind: "NEVER_SAY",
      text: "Never disclose internal recruiter phone numbers"
    })
  });

  const diffRes = await fetch(`${baseUrl}/api/scopes/${v2ScopeId}/diff`);
  assert.strictEqual(diffRes.status, 200);
  const diffData = (await diffRes.json()) as {
    currentVersion: number;
    targetVersion: number;
    addedRules: Array<{ text: string }>;
  };
  assert.strictEqual(diffData.currentVersion, 2);
  assert.strictEqual(diffData.targetVersion, 1);
  assert.strictEqual(diffData.addedRules.length, 1);
  assert.strictEqual(diffData.addedRules[0].text, "Never disclose internal recruiter phone numbers");
});
