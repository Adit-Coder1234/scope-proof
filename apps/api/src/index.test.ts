import { test } from "node:test";
import * as assert from "node:assert";
import { app } from "./index.js";
import type { Server } from "node:http";

test("GET /health returns 200 with status: ok", async () => {
  const server: Server = await new Promise((resolve) => {
    const s = app.listen(0, () => resolve(s));
  });

  try {
    const addr = server.address();
    const port = typeof addr === "object" && addr ? addr.port : 0;
    const res = await fetch(`http://localhost:${port}/health`);
    assert.strictEqual(res.status, 200);
    const body = await res.json() as { status: string; timestamp: string };
    assert.strictEqual(body.status, "ok");
    assert.ok(body.timestamp);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

