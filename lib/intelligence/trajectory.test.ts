import { describe, expect, it } from "vitest";
import { estimateTrajectory, milestoneComplete, progressPercent, velocityPerDay } from "./trajectory";

const day = (offset: number) => new Date(Date.UTC(2026, 0, 1 + offset));

describe("trajectory engine", () => {
  it("calculates bounded progress in either direction", () => { expect(progressPercent(30, 20, 25)).toBe(50); expect(progressPercent(20, 30, 25)).toBe(50); });
  it("does not estimate from insufficient history", () => { const result = estimateTrajectory({ baseline: 30, target: 20, current: 29, points: [{ date: day(0), value: 30 }] }); expect(result.status).toBe("INSUFFICIENT_DATA"); expect(result.low).toBeNull(); });
  it("detects a stalled trend", () => { const result = estimateTrajectory({ baseline: 30, target: 20, current: 29.99, points: [{ date: day(0), value: 30 }, { date: day(14), value: 29.99 }] }); expect(result.status).toBe("STALLED"); });
  it("creates an estimate range for sustained velocity", () => { const result = estimateTrajectory({ baseline: 30, target: 20, current: 27, points: [{ date: day(0), value: 30 }, { date: day(14), value: 27 }] }); expect(result.status).toBe("ON_TRACK"); expect(result.low).not.toBeNull(); expect(result.high).not.toBeNull(); expect(result.low!.getTime()).toBeLessThan(result.high!.getTime()); });
  it("uses target direction for milestone completion", () => { expect(milestoneComplete("DECREASE", 24.9, 25)).toBe(true); expect(milestoneComplete("INCREASE", 24.9, 25)).toBe(false); expect(velocityPerDay([{ date: day(0), value: 1 }, { date: day(7), value: 8 }])).toBe(1); });
});
