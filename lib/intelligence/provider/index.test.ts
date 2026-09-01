import { describe, expect, it } from "vitest";
import { deterministicProvider, extractOutputText, normalizePathwayProposal, pathwayProposalSchema, validatePathwaySemantics, type ProviderInput } from ".";

const input: ProviderInput = { current: "5K in 30 minutes", desired: "5K under 20 minutes", baseline: 30, target: 20, unit: "minutes", direction: "DECREASE", constraints: "Maximum 4 runs weekly", metrics: [{ id: "metric-5k", name: "5K time", unit: "minutes", valueType: "NUMBER", frequency: "WEEKLY" }] };
const valid = { interpretedCurrentState: "5K in 30 minutes", interpretedDesiredState: "5K under 20 minutes", constraints: ["Maximum 4 runs weekly"], assumptions: [], informationRequired: [], milestones: [{ title: "Reach 27:30", targetValue: 27.5, rationale: "First checkpoint" }, { title: "Reach 25:00", targetValue: 25, rationale: "Second checkpoint" }], suggestedMetrics: [{ name: "5K time", unit: "minutes", direction: "DECREASE", frequency: "WEEKLY", rationale: "Tracks the outcome", existingMetricId: "metric-5k" }], suggestedBehaviours: [{ name: "Easy run", rationale: "Supports volume" }], pathwayActions: [{ title: "Run twice", rationale: "Builds consistency", expectedImpact: "Creates a new observation" }], likelyLimiter: { title: "Recent volume", explanation: "No recent volume history is available.", confidence: "LOW" }, rationale: "A conservative route toward the stated outcome.", confidence: "LOW" };

describe("intelligence provider", () => {
  it("returns validated structured output without a live model", async () => {
    const output = await deterministicProvider.generatePathway(input);
    expect(pathwayProposalSchema.parse(output.proposal).milestones).toHaveLength(3);
    expect(output.proposal.pathwayActions[0].title).toContain("constraint");
  });

  it("extracts raw Responses API output text", () => {
    expect(extractOutputText({ output: [{ content: [{ type: "output_text", text: "{\"ok\":true}" }] }] })).toBe('{"ok":true}');
  });

  it("normalises only safe representation differences before strict validation", () => {
    const fixture = structuredClone(valid) as typeof valid;
    fixture.confidence = "low";
    fixture.likelyLimiter.confidence = "low";
    fixture.milestones[0].targetValue = "27.5" as unknown as number;
    fixture.suggestedMetrics[0].existingMetricId = "metric-5k  ";
    fixture.suggestedMetrics[0].direction = "decrease";
    fixture.suggestedMetrics[0].frequency = "weekly";
    const proposal = pathwayProposalSchema.parse(normalizePathwayProposal(fixture));
    expect(proposal.milestones[0].targetValue).toBe(27.5);
    expect(proposal.confidence).toBe("LOW");
    expect(validatePathwaySemantics(proposal, input)).toEqual([]);
  });

  it("rejects structural and semantic contract violations", () => {
    const malformed = structuredClone(valid) as Record<string, unknown>;
    malformed.unexpected = true;
    expect(pathwayProposalSchema.safeParse(normalizePathwayProposal(malformed)).success).toBe(false);
    const invalidMetric = structuredClone(valid);
    invalidMetric.suggestedMetrics[0].existingMetricId = "unknown-id";
    const proposal = pathwayProposalSchema.parse(invalidMetric);
    expect(validatePathwaySemantics(proposal, input)[0]).toMatchObject({ path: "suggestedMetrics.0.existingMetricId", code: "semantic_invalid" });
  });
});
