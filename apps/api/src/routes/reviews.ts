import { Router } from "express";
import { prisma } from "../prisma.js";
import { z } from "zod";

export const reviewsRouter = Router();

// List review items
reviewsRouter.get("/reviews", async (req, res) => {
  const status = req.query.status as string | undefined;

  const items = await prisma.reviewItem.findMany({
    where: status
      ? { status: status as "PENDING" | "APPROVED" | "EDITED" | "REJECTED" }
      : undefined,
    include: {
      turn: {
        include: {
          call: {
            include: {
              run: {
                include: {
                  scope: { select: { id: true, version: true, tenantId: true } }
                }
              }
            }
          }
        }
      }
    },
    orderBy: { createdAt: "desc" }
  });

  res.json(items);
});

// Submit a human review decision (Approve / Edit / Reject)
reviewsRouter.post("/reviews/:id/decision", async (req, res) => {
  const schema = z.object({
    decision: z.enum(["APPROVED", "EDITED", "REJECTED"]),
    editedUtterance: z.string().optional(),
    notes: z.string().optional(),
    decidedBy: z.string().default("Quality Lead"),
    promoteToTest: z.boolean().default(false)
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.format() });
    return;
  }

  const existing = await prisma.reviewItem.findUnique({
    where: { id: req.params.id },
    include: { turn: { include: { call: { include: { run: true } } } } }
  });

  if (!existing) {
    res.status(404).json({ error: "Review item not found" });
    return;
  }

  const updatedItem = await prisma.reviewItem.update({
    where: { id: req.params.id },
    data: {
      status: parsed.data.decision,
      decidedBy: parsed.data.decidedBy,
      decision: {
        editedUtterance: parsed.data.editedUtterance,
        notes: parsed.data.notes,
        at: new Date().toISOString()
      }
    }
  });

  // Record Audit Log
  await prisma.auditLog.create({
    data: {
      actor: parsed.data.decidedBy,
      action: "REVIEW_DECISION",
      payload: {
        reviewItemId: existing.id,
        turnId: existing.turnId,
        decision: parsed.data.decision,
        notes: parsed.data.notes
      }
    }
  });

  // If promoteToTest is true, automatically create TestCase
  let promotedCase = null;
  if (parsed.data.promoteToTest && existing.turn.call.run?.scopeId) {
    const scopeId = existing.turn.call.run.scopeId;
    promotedCase = await prisma.testCase.create({
      data: {
        scopeId,
        source: "REVIEW_PROMOTED",
        persona: {
          name: "Promoted Adversarial Caller",
          source: `Review Item ${existing.id}`,
          originalTurnIdx: existing.turn.idx
        },
        script: [
          {
            role: "caller",
            content: existing.turn.callerText
          },
          {
            role: "agent",
            content: parsed.data.editedUtterance || existing.turn.spoken || "Safe fallback",
            expected_gate: "FALLBACK"
          }
        ],
        language: "en"
      }
    });

    await prisma.reviewItem.update({
      where: { id: existing.id },
      data: { promotedCaseId: promotedCase.id }
    });

    await prisma.auditLog.create({
      data: {
        actor: parsed.data.decidedBy,
        action: "PROMOTE_TO_TEST",
        payload: {
          reviewItemId: existing.id,
          testCaseId: promotedCase.id,
          scopeId
        }
      }
    });
  }

  res.json({ reviewItem: updatedItem, promotedCase });
});

// Explicit promote-to-test endpoint (Task 5.5)
reviewsRouter.post("/reviews/:id/promote", async (req, res) => {
  const existing = await prisma.reviewItem.findUnique({
    where: { id: req.params.id },
    include: { turn: { include: { call: { include: { run: true } } } } }
  });

  if (!existing) {
    res.status(404).json({ error: "Review item not found" });
    return;
  }

  const scopeId = existing.turn.call.run?.scopeId;
  if (!scopeId) {
    res.status(400).json({ error: "No scope associated with this review item" });
    return;
  }

  const promotedCase = await prisma.testCase.create({
    data: {
      scopeId,
      source: "REVIEW_PROMOTED",
      persona: {
        name: "Promoted Regression Caller",
        notes: "Automated regression case generated from rejected review item"
      },
      script: [
        {
          role: "caller",
          content: existing.turn.callerText
        },
        {
          role: "agent",
          content: ((existing.decision as Record<string, unknown> | null)?.editedUtterance as string) || existing.turn.spoken || "Safe fallback",
          expected_gate: "FALLBACK"
        }
      ],
      language: "en"
    }
  });

  const updatedReview = await prisma.reviewItem.update({
    where: { id: existing.id },
    data: {
      status: "REJECTED",
      promotedCaseId: promotedCase.id
    }
  });

  await prisma.auditLog.create({
    data: {
      actor: "Reviewer",
      action: "PROMOTE_TO_TEST",
      payload: {
        reviewItemId: existing.id,
        testCaseId: promotedCase.id,
        scopeId
      }
    }
  });

  res.status(201).json({ reviewItem: updatedReview, testCase: promotedCase });
});
