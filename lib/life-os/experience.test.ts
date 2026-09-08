import { describe, expect, it } from "vitest";
import {
  directedMovement,
  actionConnection,
  inputStep,
  metricValue,
  recordedCount,
  trajectoryLabel,
  type ConnectionPathway,
} from "./experience";
const areas = [{ id: "health", name: "Health" }];
const objectives = [
  { id: "goal", title: "Run a faster 5K", lifeAreaId: "health" },
];
const pathway: ConnectionPathway = {
  id: "path",
  status: "ACTIVE",
  objectiveId: "goal",
  desiredDescription: "Run 5K under 20 minutes",
  objective: { id: "goal", title: "Run a faster 5K", lifeArea: areas[0] },
  metrics: [
    { role: "PRIMARY", metricDefinition: { name: "5K time" } },
    { role: "SUPPORTING", metricDefinition: { name: "Sleep" } },
  ],
  milestones: [{ title: "5K under 28 minutes", status: "ACTIVE" }],
  actions: [
    {
      taskId: "run",
      rationale: "Build consistent easy running before increasing intensity.",
    },
  ],
};
describe("honest action traceability", () => {
  it("uses the explicit action relationship and primary measurement", () => {
    const result = actionConnection(
      { id: "run", objectiveId: null, lifeAreaId: null },
      [pathway],
      objectives,
      areas,
    );
    expect(result.why).toBe(pathway.actions[0].rationale);
    expect(result.desired).toBe(pathway.desiredDescription);
    expect(result.measures).toEqual(["5K time"]);
  });
  it("explains a shared objective without claiming direct causation", () => {
    const result = actionConnection(
      { id: "strength", objectiveId: "goal", lifeAreaId: "health" },
      [pathway],
      objectives,
      areas,
    );
    expect(result.why).toBe("You linked this action to Run a faster 5K.");
    expect(result.milestone).toBe("5K under 28 minutes");
  });
  it("does not infer an outcome from area membership or a draft", () => {
    const result = actionConnection(
      { id: "sleep", objectiveId: null, lifeAreaId: "health" },
      [{ ...pathway, status: "DRAFT" }],
      objectives,
      areas,
    );
    expect(result.desired).toBeNull();
    expect(result.measures).toEqual([]);
    expect(result.why).toContain("No active outcome");
  });
  it("prefers an explicit task binding over an unrelated objective match", () => {
    const other = {
      ...pathway,
      id: "other",
      objectiveId: "other",
      actions: [],
    };
    expect(
      actionConnection(
        { id: "run", objectiveId: "other", lifeAreaId: "health" },
        [other, pathway],
        objectives,
        areas,
      ).pathwayId,
    ).toBe("path");
  });
});
describe("observation presentation", () => {
  it("counts actual entries, including zero and false, not skipped keys", () =>
    expect(
      recordedCount({ sleep: "", steps: "0", trained: "false", note: "  " }),
    ).toBe(2));
  it("distinguishes no reading from a measured zero", () => {
    expect(metricValue(undefined, "h")).toBe("Not recorded");
    expect(
      metricValue({ valueNumber: 0, valueBoolean: null, valueText: null }, "h"),
    ).toBe("0 h");
  });
  it("preserves boolean and text readings rather than inventing numeric values", () => {
    expect(
      metricValue({ valueNumber: null, valueBoolean: false, valueText: null }),
    ).toBe("No");
    expect(
      metricValue({
        valueNumber: null,
        valueBoolean: null,
        valueText: "Tired",
      }),
    ).toBe("Tired");
  });
  it("uses configured decimal precision for tactile controls", () => {
    expect(inputStep(2, "DECIMAL")).toBe(0.01);
    expect(inputStep(2, "INTEGER")).toBe(1);
  });
  it("does not label insufficient evidence as failure", () =>
    expect(trajectoryLabel("INSUFFICIENT_DATA")).toBe(
      "More observations needed",
    ));
});

it("interprets improvement using configured direction, never raw increase alone", () => {
  expect(directedMovement(-1, "DECREASE")).toBe("improved");
  expect(directedMovement(-1, "INCREASE")).toBe("deteriorated");
  expect(directedMovement(1, "NONE")).toBeNull();
  expect(directedMovement(1, "RANGE")).toBeNull();
  expect(directedMovement(0, "DECREASE")).toBeNull();
});
