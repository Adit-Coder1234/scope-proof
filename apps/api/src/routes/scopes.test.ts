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

test("GET /api/scopes returns seeded scopes with rules and facts", async () => {
  const res = await fetch(`${baseUrl}/api/scopes`);
  assert.strictEqual(res.status, 200);
  const scopes = (await res.json()) as Array<{
    id: string;
    version: number;
    rules: unknown[];
    facts: unknown[];
  }>;
  assert.ok(scopes.length > 0);
  const activeScope = scopes.find((s) => s.id === "scope_interview_v1");
  assert.ok(activeScope);
  assert.strictEqual(activeScope.version, 1);
  assert.ok(activeScope.rules.length >= 7);
  assert.ok(activeScope.facts.length >= 9);
});

test("POST /api/scopes/:id/version increments scope version and copies rules", async () => {
  // Create an isolated test tenant and scope for this test
  const tenant = await prisma.tenant.create({
    data: { name: `Test Tenant ${Date.now()}` }
  });
  const scope = await prisma.scope.create({
    data: {
      tenantId: tenant.id,
      version: 1,
      status: "ACTIVE",
      rules: {
        create: [
          { kind: "MUST_ANSWER", text: "Answer name", params: {} },
          { kind: "NEVER_SAY", text: "Never quote pay", params: {} }
        ]
      },
      facts: {
        create: [{ key: "company", value: "Test Corp" }]
      }
    }
  });

  const res = await fetch(`${baseUrl}/api/scopes/${scope.id}/version`, {
    method: "POST"
  });
  assert.strictEqual(res.status, 201);
  const newScope = (await res.json()) as {
    id: string;
    version: number;
    rules: unknown[];
    facts: unknown[];
  };
  assert.strictEqual(newScope.version, 2);
  assert.strictEqual(newScope.rules.length, 2);
  assert.strictEqual(newScope.facts.length, 1);
});

test("GET /api/scopes/:id/cases loads seeded fallback cases including F1-F4", async () => {
  const res = await fetch(`${baseUrl}/api/scopes/scope_interview_v1/cases`);
  assert.strictEqual(res.status, 200);
  const cases = (await res.json()) as Array<{
    id: string;
    language: string;
    source: string;
    script: Array<{ role: string; content: string; expected_gate?: string }>;
  }>;

  assert.strictEqual(cases.length, 15);

  const f1 = cases.find((c) => c.id === "case_f1_invented_pay");
  assert.ok(f1);
  assert.strictEqual(f1.script[1].expected_gate, "REVIEW");

  const f2 = cases.find((c) => c.id === "case_f2_impossible_slot");
  assert.ok(f2);
  assert.strictEqual(f2.script[1].expected_gate, "FALLBACK");

  const f3 = cases.find((c) => c.id === "case_f3_promise_outside_scope");
  assert.ok(f3);
  assert.strictEqual(f3.script[1].expected_gate, "FALLBACK");

  const f4 = cases.find((c) => c.id === "case_f4_opt_out");
  assert.ok(f4);
  assert.strictEqual(f4.script[1].expected_gate, "PASS");
});

test("POST /api/scopes/:id/cases rejects malformed test case payloads", async () => {
  const malformed = {
    persona: "not-an-object",
    script: "invalid-script"
  };
  const res = await fetch(`${baseUrl}/api/scopes/scope_interview_v1/cases`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(malformed)
  });
  assert.strictEqual(res.status, 400);
});
