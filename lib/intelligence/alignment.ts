import { AlignmentMessageRole, AlignmentSource, IntelligenceConfidence } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import type { Prisma } from "@prisma/client";
import { generateAlignmentTurn } from "./provider";
import { validateAlignmentProvenance } from "./alignment-contract";

export type AlignmentAssertion = { category: string; content: string; source: AlignmentSource; confidence?: IntelligenceConfidence; rationale?: string; evidence?: unknown };

export async function resumeAlignmentSession(userId: string, lifeAreaId: string) {
  const existing = await prisma.alignmentSession.findFirst({ where: { userId, lifeAreaId, status: "ACTIVE" }, orderBy: { updatedAt: "desc" } });
  return existing ?? prisma.alignmentSession.create({ data: { userId, lifeAreaId } });
}

export async function getAlignmentSession(userId: string, sessionId: string) {
  return prisma.alignmentSession.findFirst({ where: { id: sessionId, userId }, include: { lifeArea: true, messages: { orderBy: { createdAt: "asc" } }, assertions: { where: { active: true }, orderBy: { createdAt: "asc" } } } });
}

type Db = typeof prisma | Prisma.TransactionClient;
export async function persistAlignmentMessage(sessionId: string, role: AlignmentMessageRole, content: string, provenance?: { provider?: string; model?: string; schemaVersion?: string; validation?: string; clientTurnId?: string }, db: Db = prisma) {
  return db.alignmentMessage.create({ data: { sessionId, role, content, ...provenance } });
}

export async function updateAlignmentUnderstanding(sessionId: string, assertions: AlignmentAssertion[], db: Db = prisma) {
  for (const assertion of assertions) {
    const content = assertion.content.trim();
    if (!content) continue;
    const duplicate = await db.alignmentUnderstanding.findFirst({ where: { sessionId, category: assertion.category, content, source: assertion.source, active: true } });
    if (!duplicate) await db.alignmentUnderstanding.create({ data: { sessionId, category: assertion.category, content, source: assertion.source, confidence: assertion.confidence ?? "INSUFFICIENT_DATA", rationale: assertion.rationale, evidence: assertion.evidence as never } });
  }
}

export async function correctAlignmentAssertion(userId: string, sessionId: string, assertionId: string, correction: string) {
  const assertion = await prisma.alignmentUnderstanding.findFirst({ where: { id: assertionId, sessionId, session: { userId }, active: true } });
  if (!assertion) throw new Error("Alignment assertion not found.");
  return prisma.$transaction(async (tx) => {
    const message = await tx.alignmentMessage.create({ data: { sessionId, role: "CORRECTION", content: correction } });
    await tx.alignmentUnderstanding.update({ where: { id: assertion.id }, data: { active: false, correctedById: message.id } });
    return message;
  });
}

export async function submitAlignmentTurn(userId: string, sessionId: string, content: string, clientTurnId: string) {
  const session = await getAlignmentSession(userId, sessionId);
  if (!session || session.status !== "ACTIVE") throw new Error("Alignment session not found.");
  const text = content.trim(); if (!text) throw new Error("Share what matters before continuing.");
  if (!clientTurnId.trim()) throw new Error("A turn identity is required.");
  let turn = await prisma.alignmentMessage.findFirst({ where: { sessionId, clientTurnId } });
  if (turn?.turnStatus === "COMPLETED" || turn?.turnStatus === "PENDING") return getAlignmentSession(userId, session.id);
  if (!turn) { try { turn = await persistAlignmentMessage(session.id, "USER", text, { clientTurnId, validation: "PENDING" }); await prisma.alignmentMessage.update({ where: { id: turn.id }, data: { turnStatus: "PENDING", turnError: null } }); } catch { return getAlignmentSession(userId, session.id); } } else { await prisma.alignmentMessage.update({ where: { id: turn.id }, data: { turnStatus: "PENDING", turnError: null } }); }
  const observed = await prisma.goalPathway.findMany({ where: { userId, objective: { lifeAreaId: session.lifeAreaId }, status: "ACTIVE" }, select: { currentDescription: true, desiredDescription: true, trajectoryStatus: true } });
  const evidenceReferences = observed.map((_, index) => `pathway:${index + 1}`);
  try {
    const generated = await generateAlignmentTurn({ lifeArea: { id: session.lifeArea.id, name: session.lifeArea.name }, userMessage: text, understanding: session.assertions, recentMessages: session.messages.slice(-8).map((message) => ({ role: message.role, content: message.content })), observed: observed.map((pathway, index) => ({ reference: evidenceReferences[index], ...pathway })) });
    if (!validateAlignmentProvenance(generated.output, text, evidenceReferences)) throw new Error("Alignment response could not be verified against your stated and observed context.");
    await prisma.$transaction(async (tx) => { await persistAlignmentMessage(session.id, "ASSISTANT", generated.output.nextQuestion, { provider: generated.provider, model: generated.model, schemaVersion: "alignment-v1", validation: "PASS" }, tx); await updateAlignmentUnderstanding(session.id, generated.output.assertions as AlignmentAssertion[], tx); await tx.alignmentMessage.update({ where: { id: turn!.id }, data: { turnStatus: "COMPLETED", validation: "PASS" } }); });
    return getAlignmentSession(userId, session.id);
  } catch (error) { const timedOut = error instanceof Error && error.message.includes("timed out"); await prisma.alignmentMessage.update({ where: { id: turn.id }, data: { turnStatus: timedOut ? "TIMED_OUT" : "FAILED", turnError: timedOut ? "Life OS took too long to respond. Your answer is saved." : "Life OS could not respond safely. Your answer is saved." } }); throw error instanceof Error ? error : new Error("Alignment could not respond safely. Please retry."); }
}
