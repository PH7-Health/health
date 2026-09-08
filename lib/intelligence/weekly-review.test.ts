import { beforeEach, expect, it, vi } from "vitest";
import { weekStart } from "@/lib/life-os/date";
const db = vi.hoisted(() => ({
  lifeArea: { findMany: vi.fn() },
  metricDefinition: { findMany: vi.fn() },
  metricEntry: { findMany: vi.fn() },
  habit: { findMany: vi.fn() },
  goalPathway: { findMany: vi.fn() },
  task: { findMany: vi.fn() },
}));
vi.mock("@/lib/db/prisma", () => ({ prisma: db }));
import { getDeterministicWeeklyIntelligence } from "./service";
beforeEach(() => {
  vi.clearAllMocks();
  db.lifeArea.findMany.mockResolvedValue([{ id: "work", name: "Work" }]);
  db.habit.findMany.mockResolvedValue([]);
  db.goalPathway.findMany.mockResolvedValue([]);
  db.task.findMany.mockResolvedValue([]);
  db.metricDefinition.findMany.mockResolvedValue([
    { id: "run", name: "5K time", targetDirection: "DECREASE" },
    { id: "sleep", name: "Sleep", targetDirection: "INCREASE" },
    { id: "neutral", name: "Unspecified", targetDirection: "NONE" },
  ]);
  db.metricEntry.findMany.mockImplementation(({ where }) =>
    where.metricDefinitionId
      ? Promise.resolve([
          { localDate: weekStart(), valueNumber: 30 },
          { localDate: new Date(), valueNumber: 29 },
        ])
      : Promise.resolve([]),
  );
});
it("uses configured direction and current-week observations, not the oldest historical samples", async () => {
  const result = await getDeterministicWeeklyIntelligence("qa");
  expect(result.improved).toEqual(["5K time"]);
  expect(result.deteriorated).toEqual(["Sleep"]);
  const queries = db.metricEntry.findMany.mock.calls.filter(
    ([q]) => q.where.metricDefinitionId,
  );
  expect(queries).toHaveLength(3);
  for (const [query] of queries) {
    expect(query.where.localDate.gte).toEqual(weekStart());
    expect(
      query.where.localDate.lt.getTime() - query.where.localDate.gte.getTime(),
    ).toBe(7 * 86400000);
    expect(query.take).toBeUndefined();
  }
});
it("does not call an area neglected just because no habit is configured", async () => {
  expect((await getDeterministicWeeklyIntelligence("qa")).neglected).toEqual(
    [],
  );
});
it("does not force a conclusion from missing numeric data", async () => {
  db.metricEntry.findMany.mockResolvedValue([]);
  const result = await getDeterministicWeeklyIntelligence("qa");
  expect(result.improved).toEqual([]);
  expect(result.deteriorated).toEqual([]);
  expect(result.confidence).toBe("INSUFFICIENT_DATA");
  expect(result.recommendation.title).toBe("No change required");
});
