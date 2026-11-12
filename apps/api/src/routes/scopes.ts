import { Router } from "express";
import { prisma } from "../prisma.js";
import { RuleKindSchema, ScopeStatusSchema } from "@scopeproof/contracts";
import { z } from "zod";

export const scopesRouter = Router();

// Create tenant
scopesRouter.post("/tenants", async (req, res) => {
  const schema = z.object({ name: z.string().min(1) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.format() });
    return;
  }
  const tenant = await prisma.tenant.create({ data: { name: parsed.data.name } });
  res.status(201).json(tenant);
});

// List tenants
scopesRouter.get("/tenants", async (_req, res) => {
  const tenants = await prisma.tenant.findMany({ include: { scopes: true } });
  res.json(tenants);
});

// Create scope
scopesRouter.post("/scopes", async (req, res) => {
  const schema = z.object({
    tenantId: z.string().min(1),
    status: ScopeStatusSchema.optional().default("DRAFT")
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.format() });
    return;
  }

  // Determine latest version for this tenant
  const latest = await prisma.scope.findFirst({
    where: { tenantId: parsed.data.tenantId },
    orderBy: { version: "desc" }
  });
  const nextVersion = latest ? latest.version + 1 : 1;

  const scope = await prisma.scope.create({
    data: {
      tenantId: parsed.data.tenantId,
      version: nextVersion,
      status: parsed.data.status
    }
  });
  res.status(201).json(scope);
});

// List scopes
scopesRouter.get("/scopes", async (req, res) => {
  const tenantId = req.query.tenantId as string | undefined;
  const scopes = await prisma.scope.findMany({
    where: tenantId ? { tenantId } : undefined,
    include: {
      rules: true,
      facts: true,
      _count: { select: { cases: true, runs: true } }
    },
    orderBy: { version: "desc" }
  });
  res.json(scopes);
});

// Get scope by ID with full relations
scopesRouter.get("/scopes/:id", async (req, res) => {
  const scope = await prisma.scope.findUnique({
    where: { id: req.params.id },
    include: {
      tenant: true,
      rules: true,
      facts: true,
      cases: true,
      runs: { orderBy: { startedAt: "desc" }, take: 5 }
    }
  });
  if (!scope) {
    res.status(404).json({ error: "Scope not found" });
    return;
  }
  res.json(scope);
});

// Bump scope version (copy forward active rules and facts)
scopesRouter.post("/scopes/:id/version", async (req, res) => {
  const existing = await prisma.scope.findUnique({
    where: { id: req.params.id },
    include: { rules: true, facts: true }
  });
  if (!existing) {
    res.status(404).json({ error: "Scope not found" });
    return;
  }

  const latest = await prisma.scope.findFirst({
    where: { tenantId: existing.tenantId },
    orderBy: { version: "desc" }
  });
  const newVersion = (latest ? latest.version : existing.version) + 1;

  const newScope = await prisma.scope.create({
    data: {
      tenantId: existing.tenantId,
      version: newVersion,
      status: "ACTIVE",
      rules: {
        create: existing.rules.map((r) => ({
          kind: r.kind,
          text: r.text,
          params: r.params as object
        }))
      },
      facts: {
        create: existing.facts.map((f) => ({
          key: f.key,
          value: f.value
        }))
      }
    },
    include: { rules: true, facts: true }
  });

  res.status(201).json(newScope);
});

// Diff two scope versions (Task 5.6)
scopesRouter.get("/scopes/:id/diff", async (req, res) => {
  const current = await prisma.scope.findUnique({
    where: { id: req.params.id },
    include: { rules: true, facts: true }
  });
  if (!current) {
    res.status(404).json({ error: "Current scope not found" });
    return;
  }

  const compareWithId = req.query.compareWith as string | undefined;
  let target = null;
  if (compareWithId) {
    target = await prisma.scope.findUnique({
      where: { id: compareWithId },
      include: { rules: true, facts: true }
    });
  } else {
    target = await prisma.scope.findFirst({
      where: {
        tenantId: current.tenantId,
        version: current.version - 1
      },
      include: { rules: true, facts: true }
    });
  }

  if (!target) {
    res.json({
      currentVersion: current.version,
      targetVersion: null,
      message: "No previous version available to compare.",
      addedRules: current.rules,
      removedRules: [],
      addedFacts: current.facts,
      removedFacts: [],
      modifiedFacts: []
    });
    return;
  }

  const targetRuleTexts = new Set(target.rules.map((r) => `${r.kind}:${r.text}`));
  const currentRuleTexts = new Set(current.rules.map((r) => `${r.kind}:${r.text}`));

  const addedRules = current.rules.filter((r) => !targetRuleTexts.has(`${r.kind}:${r.text}`));
  const removedRules = target.rules.filter((r) => !currentRuleTexts.has(`${r.kind}:${r.text}`));

  const targetFactKeys = new Map(target.facts.map((f) => [f.key, f.value]));
  const currentFactKeys = new Map(current.facts.map((f) => [f.key, f.value]));

  const addedFacts = current.facts.filter((f) => !targetFactKeys.has(f.key));
  const removedFacts = target.facts.filter((f) => !currentFactKeys.has(f.key));
  const modifiedFacts = current.facts.filter(
    (f) => targetFactKeys.has(f.key) && targetFactKeys.get(f.key) !== f.value
  );

  res.json({
    currentId: current.id,
    currentVersion: current.version,
    targetId: target.id,
    targetVersion: target.version,
    addedRules,
    removedRules,
    addedFacts,
    removedFacts,
    modifiedFacts
  });
});

// Add rule to scope
scopesRouter.post("/scopes/:id/rules", async (req, res) => {
  const schema = z.object({
    kind: RuleKindSchema,
    text: z.string().min(1),
    params: z.record(z.unknown()).default({})
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.format() });
    return;
  }

  const rule = await prisma.rule.create({
    data: {
      scopeId: req.params.id,
      kind: parsed.data.kind,
      text: parsed.data.text,
      params: parsed.data.params as object
    }
  });
  res.status(201).json(rule);
});

// List rules for scope
scopesRouter.get("/scopes/:id/rules", async (req, res) => {
  const rules = await prisma.rule.findMany({
    where: { scopeId: req.params.id }
  });
  res.json(rules);
});

// Add fact to scope
scopesRouter.post("/scopes/:id/facts", async (req, res) => {
  const schema = z.object({
    key: z.string().min(1),
    value: z.string().min(1)
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.format() });
    return;
  }

  const fact = await prisma.fact.create({
    data: {
      scopeId: req.params.id,
      key: parsed.data.key,
      value: parsed.data.value
    }
  });
  res.status(201).json(fact);
});

// List facts for scope
scopesRouter.get("/scopes/:id/facts", async (req, res) => {
  const facts = await prisma.fact.findMany({
    where: { scopeId: req.params.id }
  });
  res.json(facts);
});

