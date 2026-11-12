import { Router } from "express";
import { prisma } from "../prisma.js";
import { GateOutcomeSchema, CarrierSchema } from "@scopeproof/contracts";
import { z } from "zod";

export const runsRouter = Router();

// Create a new run
runsRouter.post("/runs", async (req, res) => {
  const schema = z.object({
    scopeId: z.string().min(1),
    promptVersion: z.string().default("v1.0"),
    model: z.string().min(1)
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.format() });
    return;
  }

  const run = await prisma.run.create({
    data: {
      scopeId: parsed.data.scopeId,
      promptVersion: parsed.data.promptVersion,
      model: parsed.data.model
    }
  });
  res.status(201).json(run);
});

// Create a call within a run
runsRouter.post("/runs/:id/calls", async (req, res) => {
  const schema = z.object({
    caseId: z.string().optional(),
    carrier: CarrierSchema.default("TELNYX"),
    livekitRoom: z.string().min(1),
    recordingUrl: z.string().optional(),
    latencyP50Ms: z.number().int().optional()
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.format() });
    return;
  }

  const call = await prisma.call.create({
    data: {
      runId: req.params.id,
      caseId: parsed.data.caseId,
      carrier: parsed.data.carrier,
      livekitRoom: parsed.data.livekitRoom,
      recordingUrl: parsed.data.recordingUrl,
      latencyP50Ms: parsed.data.latencyP50Ms
    }
  });
  res.status(201).json(call);
});

// Get single call with ordered turns (Task 5.3 Live transcript view)
runsRouter.get("/calls/:id", async (req, res) => {
  const call = await prisma.call.findUnique({
    where: { id: req.params.id },
    include: {
      testCase: true,
      run: { include: { scope: { select: { id: true, version: true, tenant: true } } } },
      turns: {
        include: { reviewItem: true },
        orderBy: { idx: "asc" }
      }
    }
  });
  if (!call) {
    res.status(404).json({ error: "Call not found" });
    return;
  }
  res.json(call);
});

// Record a turn for a call
runsRouter.post("/calls/:id/turns", async (req, res) => {
  const schema = z.object({
    idx: z.number().int().min(0),
    callerText: z.string(),
    proposed: z.record(z.unknown()),
    spoken: z.string().nullable().optional(),
    gate: GateOutcomeSchema,
    judgeScore: z.number().min(0).max(1).nullable().optional(),
    judgeReason: z.string().nullable().optional(),
    flags: z.array(z.string()).default([])
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.format() });
    return;
  }

  const turn = await prisma.turn.create({
    data: {
      callId: req.params.id,
      idx: parsed.data.idx,
      callerText: parsed.data.callerText,
      proposed: parsed.data.proposed as object,
      spoken: parsed.data.spoken,
      gate: parsed.data.gate,
      judgeScore: parsed.data.judgeScore,
      judgeReason: parsed.data.judgeReason,
      flags: parsed.data.flags
    }
  });

  // If gate is REVIEW, automatically open a ReviewItem
  let reviewItem = null;
  if (parsed.data.gate === "REVIEW") {
    reviewItem = await prisma.reviewItem.create({
      data: {
        turnId: turn.id,
        status: "PENDING"
      }
    });
  }

  res.status(201).json({ turn, reviewItem });
});

// Update call metrics
runsRouter.patch("/calls/:id", async (req, res) => {
  const schema = z.object({
    latencyP50Ms: z.number().int().optional(),
    recordingUrl: z.string().optional()
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.format() });
    return;
  }
  const call = await prisma.call.update({
    where: { id: req.params.id },
    data: parsed.data
  });
  res.json(call);
});

// Update run status & passRate
runsRouter.patch("/runs/:id", async (req, res) => {
  const schema = z.object({
    passRate: z.number().min(0).max(1).optional(),
    completedAt: z.string().datetime().optional()
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.format() });
    return;
  }

  const run = await prisma.run.update({
    where: { id: req.params.id },
    data: {
      passRate: parsed.data.passRate,
      completedAt: parsed.data.completedAt ? new Date(parsed.data.completedAt) : new Date()
    }
  });
  res.json(run);
});

// Get run details with calls, turns, review items
runsRouter.get("/runs/:id", async (req, res) => {
  const run = await prisma.run.findUnique({
    where: { id: req.params.id },
    include: {
      scope: { include: { tenant: true } },
      calls: {
        include: {
          testCase: true,
          turns: {
            include: { reviewItem: true },
            orderBy: { idx: "asc" }
          }
        }
      }
    }
  });
  if (!run) {
    res.status(404).json({ error: "Run not found" });
    return;
  }
  res.json(run);
});

// List all runs (including calls for live monitor)
runsRouter.get("/runs", async (req, res) => {
  const scopeId = req.query.scopeId as string | undefined;
  const runs = await prisma.run.findMany({
    where: scopeId ? { scopeId } : undefined,
    include: {
      scope: { select: { id: true, version: true, tenant: { select: { name: true } } } },
      calls: {
        include: {
          turns: { orderBy: { idx: "asc" } }
        },
        orderBy: { createdAt: "desc" }
      },
      _count: { select: { calls: true } }
    },
    orderBy: { startedAt: "desc" }
  });
  res.json(runs);
});

// List recent calls directly
runsRouter.get("/calls", async (_req, res) => {
  const calls = await prisma.call.findMany({
    include: {
      turns: { orderBy: { idx: "asc" } },
      run: { include: { scope: true } }
    },
    orderBy: { createdAt: "desc" },
    take: 20
  });
  res.json(calls);
});

