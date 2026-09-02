import { z } from "zod";

const source = z.enum(["STATED", "INFERRED", "OBSERVED"]);
const confidence = z.enum(["HIGH", "MEDIUM", "LOW", "INSUFFICIENT_DATA"]);
export const alignmentAssertionSchema = z.object({ category: z.enum(["CURRENT", "DESIRED", "MOTIVATION", "PRIORITY", "CONSTRAINT", "ANTI_GOAL", "UNCERTAINTY", "TENSION"]), content: z.string().min(1).max(500), source, confidence, rationale: z.string().max(500).optional(), evidenceReferences: z.array(z.string().min(1)).max(6).default([]) }).strict().superRefine((value, ctx) => {
  if (value.source === "INFERRED" && (!value.rationale || !value.evidenceReferences.length)) ctx.addIssue({ code: "custom", message: "Inferences require rationale and evidence references." });
  if (value.source === "OBSERVED" && !value.evidenceReferences.length) ctx.addIssue({ code: "custom", message: "Observed assertions require evidence references." });
});

export const alignmentTurnSchema = z.object({ assertions: z.array(alignmentAssertionSchema).max(16), nextQuestion: z.string().min(1).max(500), questionRationale: z.string().min(1).max(500) }).strict();
export type AlignmentTurn = z.infer<typeof alignmentTurnSchema>;

/** Canonicalise only harmless provider representations before strict validation. */
export function normalizeAlignmentTurn(value: unknown): unknown {
  if (!value || typeof value !== "object" || Array.isArray(value)) return value;
  const turn = structuredClone(value) as Record<string, unknown>;
  if (Array.isArray(turn.assertions)) turn.assertions = turn.assertions.map((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return item;
    const assertion = item as Record<string, unknown>;
    if (assertion.rationale === null) delete assertion.rationale;
    for (const key of ["category", "source", "confidence"] as const) if (typeof assertion[key] === "string") assertion[key] = assertion[key].trim().toUpperCase();
    return assertion;
  });
  return turn;
}

/** Stated facts must appear in the user turn; observed facts must cite the bounded context. */
export function validateAlignmentProvenance(turn: AlignmentTurn, userMessage: string, evidenceReferences: string[]) {
  const user = userMessage.toLowerCase();
  return turn.assertions.every((assertion) => {
    if (assertion.source === "STATED") return assertion.content.toLowerCase().split(/\s+/).filter((word) => word.length > 4).some((word) => user.includes(word));
    if (assertion.source === "OBSERVED") return assertion.evidenceReferences.every((reference) => evidenceReferences.includes(reference));
    return Boolean(assertion.rationale && assertion.evidenceReferences.length);
  });
}
