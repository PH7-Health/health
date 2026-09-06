import { describe, expect, it } from "vitest";
import { deriveInterviewProgress } from "./interview-progress";

describe("interview progress", () => {
  it("derives exploration from missing strategic understanding rather than turn count", () => expect(deriveInterviewProgress([]).stage).toBe("EXPLORE"));
  it("moves to challenge when current and desired reality are known", () => expect(deriveInterviewProgress([{ category: "CURRENT", source: "STATED" }, { category: "DESIRED", source: "STATED" }]).stage).toBe("CHALLENGE"));
  it("becomes ready only when canonical strategy and core dimensions exist", () => {
    const progress = deriveInterviewProgress([{ category: "CURRENT", source: "STATED" }, { category: "DESIRED", source: "STATED" }, { category: "CONSTRAINT", source: "STATED" }], { measurement: true, strategy: true });
    expect(progress.stage).toBe("READY"); expect(progress.ready).toBe(true);
  });
  it("explains the next missing strategic dimension", () => expect(deriveInterviewProgress([{ category: "CURRENT", source: "STATED" }]).reason).toContain("good outcome"));
});
