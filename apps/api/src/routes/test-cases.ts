import { Router } from "express";
import { prisma } from "../prisma.js";
import { TestCaseSchema } from "@scopeproof/contracts";
import { z } from "zod";

export const testCasesRouter = Router();

// Create single test case
testCasesRouter.post("/scopes/:id/cases", async (req, res) => {
  const inputSchema = TestCaseSchema.omit({ id: true, scope_id: true }).extend({
    rule_id: z.string().optional()
  });

  const parsed = inputSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.format() });
    return;
  }

  const testCase = await prisma.testCase.create({
    data: {
      scopeId: req.params.id,
      ruleId: parsed.data.rule_id,
      persona: parsed.data.persona as object,
      script: parsed.data.script as object,
      language: parsed.data.language,
      source: parsed.data.source
    }
  });

  res.status(201).json(testCase);
});

// Bulk create test cases
testCasesRouter.post("/scopes/:id/cases/bulk", async (req, res) => {
  const bulkSchema = z.array(
    TestCaseSchema.omit({ id: true, scope_id: true }).extend({
      rule_id: z.string().optional()
    })
  );

  const parsed = bulkSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.format() });
    return;
  }

  const created = await prisma.$transaction(
    parsed.data.map((c) =>
      prisma.testCase.create({
        data: {
          scopeId: req.params.id,
          ruleId: c.rule_id,
          persona: c.persona as object,
          script: c.script as object,
          language: c.language,
          source: c.source
        }
      })
    )
  );

  res.status(201).json({ count: created.length, cases: created });
});

// List test cases for scope
testCasesRouter.get("/scopes/:id/cases", async (req, res) => {
  const language = req.query.language as string | undefined;
  const cases = await prisma.testCase.findMany({
    where: {
      scopeId: req.params.id,
      language: language ? language : undefined
    },
    orderBy: { createdAt: "asc" }
  });
  res.json(cases);
});

// Get test case by ID
testCasesRouter.get("/cases/:id", async (req, res) => {
  const testCase = await prisma.testCase.findUnique({
    where: { id: req.params.id }
  });
  if (!testCase) {
    res.status(404).json({ error: "TestCase not found" });
    return;
  }
  res.json(testCase);
});
