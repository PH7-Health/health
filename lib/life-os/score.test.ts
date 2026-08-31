import { describe, expect, it } from "vitest";
import { calculateScore } from "./score";

describe("calculateScore", () => {
  it("weights completed daily actions and exposes a status", () => {
    expect(calculateScore([{ label: "Health", expected: 2, completed: 2, weight: 2 }, { label: "Tasks", expected: 2, completed: 1, weight: 1 }])).toMatchObject({ score: 83, status: "ON_TRACK" });
  });
  it("does not award more than a component’s maximum", () => {
    expect(calculateScore([{ label: "Health", expected: 1, completed: 3, weight: 1 }]).score).toBe(100);
  });
});
