import { z, type ZodIssue } from "zod";
import { coachingAnswerSchema, weeklyCoachingSchema, type CoachingAnswer, type WeeklyCoaching } from "../coaching-schema";

export const PATHWAY_SCHEMA_VERSION = "v3";
const confidenceValues = ["HIGH", "MEDIUM", "LOW", "INSUFFICIENT_DATA"] as const;
const directionValues = ["INCREASE", "DECREASE"] as const;
const frequencyValues = ["DAILY", "WEEKLY", "AS_NEEDED"] as const;

const confidence = z.enum(confidenceValues);
const milestoneSchema = z.object({ title: z.string().min(1), targetValue: z.number().finite().nullable(), rationale: z.string().min(1) }).strict();
const metricSchema = z.object({ name: z.string().min(1), unit: z.string().min(1).nullable(), direction: z.enum(directionValues), frequency: z.enum(frequencyValues), rationale: z.string().min(1), existingMetricId: z.string().min(1).nullable() }).strict();
const behaviourSchema = z.object({ name: z.string().min(1), rationale: z.string().min(1) }).strict();
const actionSchema = z.object({ title: z.string().min(1), rationale: z.string().min(1), expectedImpact: z.string().min(1) }).strict();

export const pathwayProposalSchema = z.object({
  interpretedCurrentState: z.string().min(1),
  interpretedDesiredState: z.string().min(1),
  constraints: z.array(z.string()),
  assumptions: z.array(z.string()),
  informationRequired: z.array(z.string()),
  milestones: z.array(milestoneSchema).min(1).max(8),
  suggestedMetrics: z.array(metricSchema).max(4),
  suggestedBehaviours: z.array(behaviourSchema).max(5),
  pathwayActions: z.array(actionSchema).min(1).max(3),
  likelyLimiter: z.object({ title: z.string().min(1), explanation: z.string().min(1), confidence }).strict(),
  rationale: z.string().min(1),
  confidence
}).strict();

export type PathwayProposal = z.infer<typeof pathwayProposalSchema>;
export type ProviderInput = { current: string; desired: string; baseline: number | null; target: number | null; unit: string | null; direction: string; constraints: string | null; metrics: Array<{ id: string; name: string; unit: string | null; valueType: string; frequency: string }> };
export type ProviderResult = { provider: string; model: string | null; proposal: PathwayProposal; requestId?: string | null };
export type ValidationIssue = { path: string; code: string; expected: string | null; received: string | null; valueCategory: string; missing: boolean; enumMismatch: boolean; nullability: boolean; representation: "numeric_string" | "none" | "other" };
export type ResponseValidationDiagnostic = { provider: string; model: string | null; requestId: string | null; schemaVersion: string; status: "JSON_PARSE_FAILED" | "ZOD_FAILED" | "SEMANTIC_FAILED"; issues: ValidationIssue[] };

export class IntelligenceProviderError extends Error {
  constructor(message: string, public readonly code: "MISSING_CONFIGURATION" | "REQUEST_FAILED" | "INVALID_RESPONSE", public readonly diagnostic?: ResponseValidationDiagnostic) { super(message); }
}
export interface IntelligenceProvider { name: string; generatePathway(input: ProviderInput): Promise<ProviderResult>; }

const textSchema = { type: "string" };
const nullableTextSchema = { type: ["string", "null"] };
const confidenceSchema = { type: "string", enum: confidenceValues };
const required = (properties: Record<string, unknown>) => ({ type: "object", additionalProperties: false, properties, required: Object.keys(properties) });
export const openAIPathwaySchema = {
  name: "life_os_pathway",
  strict: true,
  schema: required({
    interpretedCurrentState: textSchema,
    interpretedDesiredState: textSchema,
    constraints: { type: "array", items: textSchema },
    assumptions: { type: "array", items: textSchema },
    informationRequired: { type: "array", items: textSchema },
    milestones: { type: "array", minItems: 1, maxItems: 8, items: required({ title: textSchema, targetValue: { type: ["number", "null"] }, rationale: textSchema }) },
    suggestedMetrics: { type: "array", maxItems: 4, items: required({ name: textSchema, unit: nullableTextSchema, direction: { type: "string", enum: directionValues }, frequency: { type: "string", enum: frequencyValues }, rationale: textSchema, existingMetricId: nullableTextSchema }) },
    suggestedBehaviours: { type: "array", maxItems: 5, items: required({ name: textSchema, rationale: textSchema }) },
    pathwayActions: { type: "array", minItems: 1, maxItems: 3, items: required({ title: textSchema, rationale: textSchema, expectedImpact: textSchema }) },
    likelyLimiter: required({ title: textSchema, explanation: textSchema, confidence: confidenceSchema }),
    rationale: textSchema,
    confidence: confidenceSchema
  })
} as const;

export class DeterministicProvider implements IntelligenceProvider {
  name = "deterministic-v1";
  async generatePathway(input: ProviderInput): Promise<ProviderResult> {
    const milestones = numericMilestones(input.baseline, input.target, input.unit, input.direction);
    const metric = input.metrics.find((item) => item.unit?.toLowerCase() === input.unit?.toLowerCase()) ?? null;
    return { provider: this.name, model: null, proposal: pathwayProposalSchema.parse({ interpretedCurrentState: input.current, interpretedDesiredState: input.desired, constraints: input.constraints ? [input.constraints] : [], assumptions: ["Deterministic fallback used; review the pathway before approval."], informationRequired: metric ? [] : ["Confirm the measurement to use for progress."], milestones: milestones.length ? milestones : [{ title: "Define the first observable milestone", targetValue: null, rationale: "This outcome needs a measurable checkpoint." }], suggestedMetrics: [{ name: metric?.name ?? `${input.desired} progress`, unit: input.unit, direction: input.direction === "DECREASE" ? "DECREASE" : "INCREASE", frequency: "WEEKLY", rationale: metric ? "An existing metric has a compatible unit." : "A measurable signal is needed for deterministic trajectory calculations.", existingMetricId: metric?.id ?? null }], suggestedBehaviours: [], pathwayActions: [{ title: input.constraints ? "Choose the smallest action that respects your stated constraints." : "Choose one leading action that produces progress evidence this week.", rationale: "Creates the next useful evidence of progress.", expectedImpact: "Improves visibility into the pathway." }], likelyLimiter: { title: "Insufficient data", explanation: "No longitudinal metric data is available yet.", confidence: "INSUFFICIENT_DATA" }, rationale: "Structured fallback proposal.", confidence: input.baseline != null && input.target != null ? "LOW" : "INSUFFICIENT_DATA" }) };
  }
}

class OpenAIProvider implements IntelligenceProvider {
  name = "openai";
  async generatePathway(input: ProviderInput): Promise<ProviderResult> {
    const apiKey = process.env.OPENAI_API_KEY;
    const model = process.env.OPENAI_MODEL;
    if (!apiKey || !model) throw new IntelligenceProviderError("OpenAI is not configured for this environment. You can retry when configuration is available or use the clearly labelled deterministic fallback.", "MISSING_CONFIGURATION");
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 30_000);
    let requestId: string | null = null;
    try {
      const response = await fetch("https://api.openai.com/v1/responses", { method: "POST", signal: controller.signal, headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" }, body: JSON.stringify({ model, instructions: "You are a cautious Life OS pathway planner. Return only the constrained schema. Preserve the user's stated baseline and target; do not calculate dates, velocities, score arithmetic, or invent metric identifiers. A suggested metric must use an existingMetricId only when it exactly matches a supplied metric. Milestones must be ordered from baseline toward target and strictly between them when both values are supplied.", input: JSON.stringify(input), text: { format: { type: "json_schema", ...openAIPathwaySchema } } }) });
      requestId = response.headers.get("x-request-id");
      if (!response.ok) throw new IntelligenceProviderError(`OpenAI could not generate a pathway (${response.status}). Retry later.`, "REQUEST_FAILED");
      const body = await response.json() as { output_text?: string; output?: Array<{ content?: Array<{ type?: string; text?: string }> }> };
      const outputText = extractOutputText(body);
      if (!outputText) throw new IntelligenceProviderError("OpenAI returned no structured pathway.", "INVALID_RESPONSE", diagnostic(model, requestId, "JSON_PARSE_FAILED", []));
      let raw: unknown;
      try { raw = JSON.parse(outputText); } catch { throw new IntelligenceProviderError("OpenAI returned malformed structured JSON.", "INVALID_RESPONSE", diagnostic(model, requestId, "JSON_PARSE_FAILED", [])); }
      const proposal = pathwayProposalSchema.safeParse(normalizePathwayProposal(raw));
      if (!proposal.success) throw new IntelligenceProviderError("OpenAI returned a pathway that did not pass safety validation.", "INVALID_RESPONSE", diagnostic(model, requestId, "ZOD_FAILED", proposal.error.issues.map(issueDiagnostic)));
      const semanticIssues = validatePathwaySemantics(proposal.data, input);
      if (semanticIssues.length) throw new IntelligenceProviderError("OpenAI returned a pathway that did not pass deterministic validation.", "INVALID_RESPONSE", diagnostic(model, requestId, "SEMANTIC_FAILED", semanticIssues));
      return { provider: this.name, model, requestId, proposal: proposal.data };
    } catch (error) {
      if (error instanceof IntelligenceProviderError) throw error;
      throw new IntelligenceProviderError("OpenAI request failed. Retry later.", "REQUEST_FAILED");
    } finally { clearTimeout(timer); }
  }
}

export function extractOutputText(body: { output_text?: string; output?: Array<{ content?: Array<{ type?: string; text?: string }> }> }) { return body.output_text ?? body.output?.flatMap((item) => item.content ?? []).find((item) => item.type === "output_text")?.text; }

/** Canonicalise only blank nullable fields, controlled enums, and numeric text in an explicitly numeric field. */
export function normalizePathwayProposal(value: unknown): unknown {
  if (!value || typeof value !== "object" || Array.isArray(value)) return value;
  const proposal = structuredClone(value) as Record<string, unknown>;
  const trim = (item: unknown) => typeof item === "string" ? item.trim() : item;
  for (const key of ["interpretedCurrentState", "interpretedDesiredState", "rationale"] as const) proposal[key] = trim(proposal[key]);
  for (const key of ["constraints", "assumptions", "informationRequired", "suggestedBehaviours", "pathwayActions", "milestones", "suggestedMetrics"] as const) if (Array.isArray(proposal[key])) proposal[key] = proposal[key].map((item) => normalizeNested(item));
  if (proposal.likelyLimiter && typeof proposal.likelyLimiter === "object" && !Array.isArray(proposal.likelyLimiter)) proposal.likelyLimiter = normalizeNested(proposal.likelyLimiter);
  if (typeof proposal.confidence === "string") proposal.confidence = proposal.confidence.trim().toUpperCase();
  if (proposal.likelyLimiter && typeof proposal.likelyLimiter === "object" && !Array.isArray(proposal.likelyLimiter)) { const limiter = proposal.likelyLimiter as Record<string, unknown>; if (typeof limiter.confidence === "string") limiter.confidence = limiter.confidence.trim().toUpperCase(); }
  if (Array.isArray(proposal.suggestedMetrics)) proposal.suggestedMetrics = proposal.suggestedMetrics.map((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return item;
    const metric = item as Record<string, unknown>;
    for (const key of ["unit", "existingMetricId"] as const) if (typeof metric[key] === "string" && !metric[key].trim()) metric[key] = null;
    for (const key of ["direction", "frequency"] as const) if (typeof metric[key] === "string") metric[key] = metric[key].trim().toUpperCase();
    return metric;
  });
  if (Array.isArray(proposal.milestones)) proposal.milestones = proposal.milestones.map((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return item;
    const milestone = item as Record<string, unknown>;
    if (typeof milestone.targetValue === "string" && /^[-+]?(?:\d+\.?\d*|\.\d+)$/.test(milestone.targetValue.trim())) milestone.targetValue = Number(milestone.targetValue);
    return milestone;
  });
  return proposal;
}

function normalizeNested(value: unknown) { if (!value || typeof value !== "object" || Array.isArray(value)) return typeof value === "string" ? value.trim() : value; const copy = structuredClone(value) as Record<string, unknown>; for (const [key, item] of Object.entries(copy)) if (typeof item === "string") copy[key] = item.trim(); return copy; }

export function validatePathwaySemantics(proposal: PathwayProposal, input: ProviderInput): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const numeric = proposal.milestones.flatMap((item) => item.targetValue == null ? [] : [item.targetValue]);
  if (new Set(numeric).size !== numeric.length) issues.push(semanticIssue("milestones", "duplicate milestone target"));
  const decreasing = input.direction === "DECREASE";
  const baseline = input.baseline;
  const target = input.target;
  if (baseline != null && target != null) proposal.milestones.forEach((milestone, index) => { if (milestone.targetValue != null && (decreasing ? milestone.targetValue >= baseline || milestone.targetValue <= target : milestone.targetValue <= baseline || milestone.targetValue >= target)) issues.push(semanticIssue(`milestones.${index}.targetValue`, "must be strictly between baseline and final target")); });
  numeric.forEach((value, index) => { if (index > 0 && (decreasing ? value >= numeric[index - 1] : value <= numeric[index - 1])) issues.push(semanticIssue(`milestones.${index}.targetValue`, "milestones must be ordered toward the final target")); });
  proposal.suggestedMetrics.forEach((metric, index) => { const existing = metric.existingMetricId ? input.metrics.find((item) => item.id === metric.existingMetricId) : null; if (metric.existingMetricId && !existing) issues.push(semanticIssue(`suggestedMetrics.${index}.existingMetricId`, "must match a supplied metric identifier")); if (existing && metric.unit && existing.unit && metric.unit.toLowerCase() !== existing.unit.toLowerCase()) issues.push(semanticIssue(`suggestedMetrics.${index}.unit`, "must match the existing metric unit")); if (index === 0 && metric.direction !== input.direction) issues.push(semanticIssue(`suggestedMetrics.${index}.direction`, "the primary bound metric must match the pathway direction")); });
  return issues;
}

function issueDiagnostic(issue: ZodIssue): ValidationIssue { const received = "received" in issue && typeof issue.received === "string" ? issue.received : null; return { path: issue.path.join(".") || "root", code: issue.code, expected: "expected" in issue && typeof issue.expected === "string" ? issue.expected : null, received, valueCategory: received ?? (issue.code === "invalid_type" ? "unknown" : "invalid"), missing: issue.code === "invalid_type" && received === "undefined", enumMismatch: issue.code === "invalid_enum_value", nullability: issue.code === "invalid_type" && received === "null", representation: "none" }; }
function semanticIssue(path: string, expected: string): ValidationIssue { return { path, code: "semantic_invalid", expected, received: null, valueCategory: "semantic", missing: false, enumMismatch: false, nullability: false, representation: "none" }; }
function diagnostic(model: string | null, requestId: string | null, status: ResponseValidationDiagnostic["status"], issues: ValidationIssue[]): ResponseValidationDiagnostic { return { provider: "openai", model, requestId, schemaVersion: PATHWAY_SCHEMA_VERSION, status, issues }; }

export const deterministicProvider = new DeterministicProvider();
export const intelligenceProvider: IntelligenceProvider = process.env.OPENAI_API_KEY ? new OpenAIProvider() : deterministicProvider;

async function generateCoaching<T>(operation: "ask_life_os" | "weekly_coaching", brief: unknown, schema: { parse: (value: unknown) => T }, name: string): Promise<{ provider: string; model: string | null; requestId: string | null; output: T }> {
  const apiKey = process.env.OPENAI_API_KEY; const model = process.env.OPENAI_MODEL;
  if (!apiKey || !model) throw new IntelligenceProviderError("OpenAI is not configured for this environment.", "MISSING_CONFIGURATION");
  const response = await fetch("https://api.openai.com/v1/responses", { method: "POST", headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" }, body: JSON.stringify({ model, instructions: `You are Life OS coaching intelligence. Use only the supplied evidence brief. Label uncertainty; never invent facts or causation. ${operation === "weekly_coaching" ? "Return at most three priorities and allow empty sections." : "Give concise decision-oriented guidance; recommendations must be grounded in the brief."}`, input: JSON.stringify(brief), text: { format: { type: "json_schema", name, strict: true, schema: operation === "ask_life_os" ? coachingJsonSchema : weeklyJsonSchema } } }) });
  const requestId = response.headers.get("x-request-id"); if (!response.ok) throw new IntelligenceProviderError(`OpenAI coaching request failed (${response.status}).`, "REQUEST_FAILED");
  const body = await response.json() as { output?: Array<{ content?: Array<{ type?: string; text?: string }> }> }; const text = extractOutputText(body); if (!text) throw new IntelligenceProviderError("OpenAI returned no coaching output.", "INVALID_RESPONSE");
  try { return { provider: "openai", model, requestId, output: schema.parse(JSON.parse(text)) }; } catch { throw new IntelligenceProviderError("OpenAI coaching output failed validation.", "INVALID_RESPONSE"); }
}
const obj=(properties:Record<string,unknown>)=>({type:"object",additionalProperties:false,properties,required:Object.keys(properties)});
const confidenceJson={type:"string",enum:["HIGH","MEDIUM","LOW","INSUFFICIENT_DATA"]}; const evidenceJson=obj({kind:{type:"string",enum:["FACT","CALCULATION","HYPOTHESIS","INSUFFICIENT_EVIDENCE"]},statement:{type:"string"},source:{type:"string"}});
const coachingJsonSchema=obj({answer:{type:"string"},evidence:{type:"array",maxItems:8,items:evidenceJson},hypotheses:{type:"array",maxItems:3,items:{type:"string"}},recommendations:{type:"array",maxItems:3,items:obj({action:{type:"string"},why:{type:"string"},confidence:confidenceJson})},missingData:{type:"array",maxItems:4,items:{type:"string"}},confidence:confidenceJson,continueCurrentStrategy:{type:"boolean"}});
const weeklyJsonSchema=obj({weekInOneSentence:{type:"string"},biggestWin:{type:["string","null"]},biggestConcern:{type:["string","null"]},working:{type:"array",maxItems:3,items:{type:"string"}},possibleLimiters:{type:"array",maxItems:3,items:{type:"string"}},tradeOffs:{type:"array",maxItems:3,items:{type:"string"}},continue:{type:"array",maxItems:3,items:{type:"string"}},change:{type:"array",maxItems:3,items:{type:"string"}},priorities:{type:"array",maxItems:3,items:obj({action:{type:"string"},why:{type:"string"},confidence:confidenceJson})},missingInformation:{type:"array",maxItems:4,items:{type:"string"}},confidence:confidenceJson});
export const generateAskLifeOs = (brief: unknown) => generateCoaching<CoachingAnswer>("ask_life_os", brief, coachingAnswerSchema, "life_os_answer_v1");
export const generateWeeklyCoaching = (brief: unknown) => generateCoaching<WeeklyCoaching>("weekly_coaching", brief, weeklyCoachingSchema, "life_os_weekly_v1");
function numericMilestones(baseline: number | null, target: number | null, unit: string | null, direction: string) { if (baseline == null || target == null || baseline === target) return []; const steps = Math.abs(target - baseline) >= 8 ? 3 : 2; return Array.from({ length: steps }, (_, index) => { const value = Math.round((baseline + (target - baseline) * (index + 1) / (steps + 1)) * 100) / 100; return { title: `${direction === "DECREASE" ? "Reach" : "Build to"} ${value}${unit ? ` ${unit}` : ""}`, targetValue: value, rationale: "Intermediate numeric checkpoint." }; }); }
