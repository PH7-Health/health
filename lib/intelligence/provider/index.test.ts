import { describe, expect, it } from "vitest";
import { deterministicProvider, pathwayProposalSchema } from ".";

describe("intelligence provider", () => {
  it("returns validated structured output without a live model", async () => {
    const output = await deterministicProvider.generatePathway({ current: "5K in 30 minutes", desired: "5K under 20 minutes", baseline: 30, target: 20, unit: "minutes", direction: "DECREASE", constraints: "Maximum 4 runs weekly", metrics: [] });
    expect(pathwayProposalSchema.parse(output.proposal).milestones).toHaveLength(3);
    expect(output.proposal.pathwayActions[0].title).toContain("constraint");
  });
});
