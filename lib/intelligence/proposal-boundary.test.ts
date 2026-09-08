import { beforeEach, expect, it, vi } from "vitest";
const db = vi.hoisted(() => ({
  $transaction: vi.fn(),
  objective: { findFirst: vi.fn() },
  metricDefinition: { findMany: vi.fn(), findFirst: vi.fn() },
  goalPathway: { upsert: vi.fn(), update: vi.fn() },
  aIExecution: { create: vi.fn() },
  aIProposal: { create: vi.fn(), findFirst: vi.fn(), updateMany: vi.fn() },
  milestone: { updateMany: vi.fn(), createMany: vi.fn() },
  pathwayAction: { updateMany: vi.fn(), createMany: vi.fn() },
  pathwayMetric: { updateMany: vi.fn(), upsert: vi.fn() },
  pathwayRevision: { create: vi.fn() },
}));
vi.mock("@/lib/db/prisma", () => ({ prisma: db }));
import { createPathwayProposal, resolveProposal } from "./service";
import { DeterministicProvider, intelligenceProvider } from "./provider";
const input = {
  objectiveId: "goal",
  currentDescription: "5K in 30 minutes",
  desiredDescription: "5K under 20 minutes",
  baselineValue: 30,
  targetValue: 20,
  unit: "min",
  direction: "DECREASE",
};
let payload: unknown;
beforeEach(async () => {
  vi.restoreAllMocks();
  vi.clearAllMocks();
  const fixture = new DeterministicProvider();
  vi.spyOn(intelligenceProvider, "generatePathway").mockImplementation((i) =>
    fixture.generatePathway(i),
  );
  payload = (
    await fixture.generatePathway({
      current: input.currentDescription,
      desired: input.desiredDescription,
      baseline: 30,
      target: 20,
      unit: "min",
      direction: "DECREASE",
      constraints: null,
      metrics: [
        {
          id: "metric",
          name: "5K time",
          unit: "min",
          valueType: "DURATION",
          frequency: "WEEKLY",
        },
      ],
    })
  ).proposal;
  db.$transaction.mockImplementation((fn) => fn(db));
  db.objective.findFirst.mockResolvedValue({
    id: "goal",
    priority: 1,
    title: "Faster 5K",
  });
  db.metricDefinition.findMany.mockResolvedValue([
    {
      id: "metric",
      name: "5K time",
      unit: "min",
      valueType: "DURATION",
      frequency: "WEEKLY",
      targetDirection: "DECREASE",
    },
  ]);
  db.metricDefinition.findFirst.mockResolvedValue({ id: "metric" });
  db.goalPathway.upsert.mockResolvedValue({ id: "path", status: "ACTIVE" });
  db.aIProposal.create.mockImplementation(({ data }) => ({
    id: "proposal",
    ...data,
  }));
  db.aIProposal.findFirst.mockResolvedValue({
    id: "proposal",
    payload,
    dataWindow: {
      proposalVersion: 1,
      config: {
        currentDescription: input.currentDescription,
        desiredDescription: input.desiredDescription,
        baselineValue: 30,
        targetValue: 20,
        unit: "min",
        direction: "DECREASE",
        constraints: null,
        preferences: null,
        desiredDate: null,
      },
    },
    pathway: {
      id: "path",
      status: "ACTIVE",
      milestones: [{ sequence: 1, status: "ACTIVE" }],
      actions: [],
      metrics: [],
    },
  });
  db.aIProposal.updateMany.mockResolvedValue({ count: 1 });
});
it("generation stores a reviewable proposal without editing the active strategy", async () => {
  await createPathwayProposal("user", input);
  expect(db.goalPathway.upsert.mock.calls[0][0].update).toEqual({});
  expect(db.goalPathway.update).not.toHaveBeenCalled();
  expect(db.milestone.updateMany).not.toHaveBeenCalled();
  expect(db.pathwayAction.updateMany).not.toHaveBeenCalled();
  expect(
    db.aIProposal.create.mock.calls[0][0].data.dataWindow.config.targetValue,
  ).toBe(20);
  expect(db.aIExecution.create).toHaveBeenCalledOnce();
});
it("dismissal does not change canonical strategy or metric bindings", async () => {
  await resolveProposal("user", "proposal", false);
  expect(db.goalPathway.update).not.toHaveBeenCalled();
  expect(db.pathwayMetric.upsert).not.toHaveBeenCalled();
});
it("explicit acceptance archives the prior strategy and retains old checkpoints", async () => {
  await resolveProposal("user", "proposal", true);
  expect(db.pathwayRevision.create).toHaveBeenCalledOnce();
  expect(db.milestone.updateMany.mock.calls[0][0].data.status).toBe("SKIPPED");
  expect(db.milestone.createMany.mock.calls[0][0].data[0].sequence).toBe(2);
  expect(db.pathwayMetric.upsert.mock.calls[0][0].update.role).toBe("PRIMARY");
});
it("a racing duplicate acceptance cannot apply the proposal twice", async () => {
  let claimed = false;
  db.aIProposal.updateMany.mockImplementation(() => {
    if (claimed) return { count: 0 };
    claimed = true;
    return { count: 1 };
  });
  await Promise.all([
    resolveProposal("user", "proposal", true),
    resolveProposal("user", "proposal", true),
  ]);
  expect(db.pathwayRevision.create).toHaveBeenCalledOnce();
  expect(db.milestone.createMany).toHaveBeenCalledOnce();
  expect(db.pathwayMetric.upsert).toHaveBeenCalledOnce();
});
