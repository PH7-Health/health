import { z } from "zod";

const confidence = z.enum(["HIGH", "MEDIUM", "LOW", "INSUFFICIENT_DATA"]);
export const pathwayProposalSchema = z.object({
  interpretedCurrentState: z.string().min(1), interpretedDesiredState: z.string().min(1), constraints: z.array(z.string()), assumptions: z.array(z.string()), informationRequired: z.array(z.string()),
  milestones: z.array(z.object({ title: z.string().min(1), targetValue: z.number().finite().nullable(), rationale: z.string().min(1) })).min(1).max(8),
  suggestedMetrics: z.array(z.object({ name: z.string().min(1), unit: z.string().nullable(), direction: z.enum(["INCREASE", "DECREASE"]), frequency: z.enum(["DAILY", "WEEKLY", "AS_NEEDED"]), rationale: z.string().min(1), existingMetricId: z.string().nullable() })).max(4),
  suggestedBehaviours: z.array(z.object({ name: z.string().min(1), rationale: z.string().min(1) })).max(5),
  pathwayActions: z.array(z.object({ title: z.string().min(1), rationale: z.string().min(1), expectedImpact: z.string().min(1) })).min(1).max(3),
  likelyLimiter: z.object({ title: z.string().min(1), explanation: z.string().min(1), confidence }), rationale: z.string().min(1), confidence
});
export type PathwayProposal = z.infer<typeof pathwayProposalSchema>;
export type ProviderInput = { current: string; desired: string; baseline: number | null; target: number | null; unit: string | null; direction: string; constraints: string | null; metrics: Array<{ id: string; name: string; unit: string | null; valueType: string; frequency: string }> };
export type ProviderResult = { provider: string; model: string | null; proposal: PathwayProposal };
export class IntelligenceProviderError extends Error { constructor(message: string, public readonly code: "MISSING_CONFIGURATION" | "REQUEST_FAILED" | "INVALID_RESPONSE") { super(message); } }
export interface IntelligenceProvider { name: string; generatePathway(input: ProviderInput): Promise<ProviderResult>; }

export class DeterministicProvider implements IntelligenceProvider {
  name = "deterministic-v1";
  async generatePathway(input: ProviderInput): Promise<ProviderResult> {
    const milestones = numericMilestones(input.baseline, input.target, input.unit, input.direction);
    const metric = input.metrics.find((item) => item.unit?.toLowerCase() === input.unit?.toLowerCase()) ?? null;
    return { provider: this.name, model: null, proposal: pathwayProposalSchema.parse({ interpretedCurrentState: input.current, interpretedDesiredState: input.desired, constraints: input.constraints ? [input.constraints] : [], assumptions: ["Deterministic fallback used; review the pathway before approval."], informationRequired: metric ? [] : ["Confirm the measurement to use for progress."], milestones: milestones.length ? milestones : [{ title: "Define the first observable milestone", targetValue: null, rationale: "This outcome needs a measurable checkpoint." }], suggestedMetrics: [{ name: metric?.name ?? `${input.desired} progress`, unit: input.unit, direction: input.direction === "DECREASE" ? "DECREASE" : "INCREASE", frequency: "WEEKLY", rationale: metric ? "An existing metric has a compatible unit." : "A measurable signal is needed for deterministic trajectory calculations.", existingMetricId: metric?.id ?? null }], suggestedBehaviours: [], pathwayActions: [{ title: input.constraints ? "Choose the smallest action that respects your stated constraints." : "Choose one leading action that produces progress evidence this week.", rationale: "Creates the next useful evidence of progress.", expectedImpact: "Improves visibility into the pathway." }], likelyLimiter: { title: "Insufficient data", explanation: "No longitudinal metric data is available yet.", confidence: "INSUFFICIENT_DATA" }, rationale: "Structured fallback proposal." , confidence: input.baseline != null && input.target != null ? "LOW" : "INSUFFICIENT_DATA" }) };
  }
}

class OpenAIProvider implements IntelligenceProvider {
  name = "openai";
  async generatePathway(input: ProviderInput): Promise<ProviderResult> {
    const apiKey = process.env.OPENAI_API_KEY; const model = process.env.OPENAI_MODEL;
    if (!apiKey || !model) throw new IntelligenceProviderError("OpenAI is not configured for this environment. You can retry when configuration is available or use the clearly labelled deterministic fallback.", "MISSING_CONFIGURATION");
    const schema = { name: "life_os_pathway", strict: true, schema: { type: "object", additionalProperties: false, properties: { interpretedCurrentState: { type: "string" }, interpretedDesiredState: { type: "string" }, constraints: { type: "array", items: { type: "string" } }, assumptions: { type: "array", items: { type: "string" } }, informationRequired: { type: "array", items: { type: "string" } }, milestones: { type: "array", items: { type: "object", additionalProperties: false, properties: { title: { type: "string" }, targetValue: { type: ["number", "null"] }, rationale: { type: "string" } }, required: ["title", "targetValue", "rationale"] } }, suggestedMetrics: { type: "array", items: { type: "object", additionalProperties: false, properties: { name: { type: "string" }, unit: { type: ["string", "null"] }, direction: { type: "string", enum: ["INCREASE", "DECREASE"] }, frequency: { type: "string", enum: ["DAILY", "WEEKLY", "AS_NEEDED"] }, rationale: { type: "string" }, existingMetricId: { type: ["string", "null"] } }, required: ["name", "unit", "direction", "frequency", "rationale", "existingMetricId"] } }, suggestedBehaviours: { type: "array", items: { type: "object", additionalProperties: false, properties: { name: { type: "string" }, rationale: { type: "string" } }, required: ["name", "rationale"] } }, pathwayActions: { type: "array", items: { type: "object", additionalProperties: false, properties: { title: { type: "string" }, rationale: { type: "string" }, expectedImpact: { type: "string" } }, required: ["title", "rationale", "expectedImpact"] } }, likelyLimiter: { type: "object", additionalProperties: false, properties: { title: { type: "string" }, explanation: { type: "string" }, confidence: { type: "string", enum: ["HIGH", "MEDIUM", "LOW", "INSUFFICIENT_DATA"] } }, required: ["title", "explanation", "confidence"] }, rationale: { type: "string" }, confidence: { type: "string", enum: ["HIGH", "MEDIUM", "LOW", "INSUFFICIENT_DATA"] } }, required: ["interpretedCurrentState", "interpretedDesiredState", "constraints", "assumptions", "informationRequired", "milestones", "suggestedMetrics", "suggestedBehaviours", "pathwayActions", "likelyLimiter", "rationale", "confidence"] } };
    const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), 30_000);
    try {
      const response = await fetch("https://api.openai.com/v1/responses", { method: "POST", signal: controller.signal, headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" }, body: JSON.stringify({ model, instructions: "You are a cautious Life OS pathway planner. Reason semantically, but never calculate dates, velocities or score arithmetic. Reuse an existing metric only by its supplied id. Never claim certainty without data. Return only the requested schema.", input: JSON.stringify(input), text: { format: { type: "json_schema", ...schema } } }) });
      if (!response.ok) throw new IntelligenceProviderError(`OpenAI could not generate a pathway (${response.status}). Retry later.`, "REQUEST_FAILED");
      const body = await response.json() as { output_text?: string };
      if (!body.output_text) throw new IntelligenceProviderError("OpenAI returned no structured pathway.", "INVALID_RESPONSE");
      const proposal = pathwayProposalSchema.safeParse(JSON.parse(body.output_text));
      if (!proposal.success) throw new IntelligenceProviderError("OpenAI returned a pathway that did not pass safety validation.", "INVALID_RESPONSE");
      return { provider: this.name, model, proposal: proposal.data };
    } catch (error) { if (error instanceof IntelligenceProviderError) throw error; throw new IntelligenceProviderError("OpenAI request failed. Retry later.", "REQUEST_FAILED"); } finally { clearTimeout(timer); }
  }
}

export const deterministicProvider = new DeterministicProvider();
export const intelligenceProvider: IntelligenceProvider = process.env.OPENAI_API_KEY ? new OpenAIProvider() : deterministicProvider;

function numericMilestones(baseline: number | null, target: number | null, unit: string | null, direction: string) { if (baseline == null || target == null || baseline === target) return []; const steps = Math.abs(target - baseline) >= 8 ? 3 : 2; return Array.from({ length: steps }, (_, index) => { const value = Math.round((baseline + (target - baseline) * (index + 1) / (steps + 1)) * 100) / 100; return { title: `${direction === "DECREASE" ? "Reach" : "Build to"} ${value}${unit ? ` ${unit}` : ""}`, targetValue: value, rationale: "Intermediate numeric checkpoint." }; }); }
