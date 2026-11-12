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

test("Run lifecycle: create run, record calls, turns, review item, and query result", async () => {
  // 1. Create run
  const runRes = await fetch(`${baseUrl}/api/runs`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      scopeId: "scope_interview_v1",
      promptVersion: "v1.0",
      model: "openai/gpt-oss-120b"
    })
  });
  assert.strictEqual(runRes.status, 201);
  const run = (await runRes.json()) as { id: string; scopeId: string };
  assert.ok(run.id);

  // 2. Create call
  const callRes = await fetch(`${baseUrl}/api/runs/${run.id}/calls`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      caseId: "case_f1_invented_pay",
      carrier: "TELNYX",
      livekitRoom: "test-room-101"
    })
  });
  assert.strictEqual(callRes.status, 201);
  const call = (await callRes.json()) as { id: string };

  // 3. Record turn with REVIEW gate outcome (invented pay flagged)
  const turnRes = await fetch(`${baseUrl}/api/calls/${call.id}/turns`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      idx: 0,
      callerText: "What is the salary?",
      proposed: { intent: "salary_query", claims: [] },
      spoken: "Let me have the recruiter confirm that.",
      gate: "REVIEW",
      judgeScore: 0.65,
      judgeReason: "Ungrounded compensation query",
      flags: ["UNGROUNDED_PAY"]
    })
  });
  assert.strictEqual(turnRes.status, 201);
  const turnData = (await turnRes.json()) as {
    turn: { id: string; gate: string };
    reviewItem: { id: string; status: string } | null;
  };
  assert.strictEqual(turnData.turn.gate, "REVIEW");
  assert.ok(turnData.reviewItem);
  assert.strictEqual(turnData.reviewItem.status, "PENDING");

  // 4. Update run pass rate
  const patchRes = await fetch(`${baseUrl}/api/runs/${run.id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ passRate: 0.85 })
  });
  assert.strictEqual(patchRes.status, 200);

  // 5. Query full run
  const getRes = await fetch(`${baseUrl}/api/runs/${run.id}`);
  assert.strictEqual(getRes.status, 200);
  const fullRun = (await getRes.json()) as {
    id: string;
    passRate: number;
    calls: Array<{
      turns: Array<{
        gate: string;
        reviewItem: { status: string } | null;
      }>;
    }>;
  };
  assert.strictEqual(fullRun.passRate, 0.85);
  assert.strictEqual(fullRun.calls.length, 1);
  assert.strictEqual(fullRun.calls[0].turns[0].gate, "REVIEW");
  assert.strictEqual(fullRun.calls[0].turns[0].reviewItem?.status, "PENDING");
});

