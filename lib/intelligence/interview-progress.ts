export type InterviewAssertion = { category: string; source: string; confidence?: string };
type PathwayContext = { current?: boolean; desired?: boolean; constraints?: boolean; measurement?: boolean; strategy?: boolean };
export type InterviewDimension = { key: string; label: string; state: "CLEAR" | "DEVELOPING" | "UNCLEAR" };
export type InterviewStage = "EXPLORE" | "CLARIFY" | "DEFINE" | "CHALLENGE" | "SYNTHESISE" | "READY";

const has = (items: InterviewAssertion[], categories: string[]) => items.some((item) => categories.includes(item.category));
export function deriveInterviewProgress(assertions: InterviewAssertion[], pathway: PathwayContext = {}) {
  const dimensions: InterviewDimension[] = [
    { key: "current", label: "Current reality", state: has(assertions, ["CURRENT"]) || pathway.current ? "CLEAR" : "UNCLEAR" },
    { key: "desired", label: "Desired reality", state: has(assertions, ["DESIRED"]) || pathway.desired ? "CLEAR" : "UNCLEAR" },
    { key: "motivation", label: "Why it matters", state: has(assertions, ["MOTIVATION", "PRIORITY"]) ? "CLEAR" : "UNCLEAR" },
    { key: "constraints", label: "Constraints", state: has(assertions, ["CONSTRAINT", "ANTI_GOAL"]) || pathway.constraints ? "CLEAR" : "UNCLEAR" },
    { key: "tradeoffs", label: "Trade-offs", state: has(assertions, ["TENSION"]) ? "CLEAR" : has(assertions, ["CONSTRAINT", "ANTI_GOAL"]) ? "DEVELOPING" : "UNCLEAR" },
    { key: "measurement", label: "Measurement", state: pathway.measurement ? "CLEAR" : has(assertions, ["DESIRED"]) ? "DEVELOPING" : "UNCLEAR" },
    { key: "strategy", label: "Strategy", state: pathway.strategy ? "CLEAR" : has(assertions, ["CURRENT", "DESIRED", "CONSTRAINT"]) ? "DEVELOPING" : "UNCLEAR" }
  ];
  const clear = (key: string) => dimensions.find((item) => item.key === key)?.state === "CLEAR";
  const core = clear("current") && clear("desired") && clear("constraints") && clear("measurement");
  const stage: InterviewStage = core && clear("strategy") ? "READY" : core ? "SYNTHESISE" : clear("current") && clear("desired") ? "CHALLENGE" : clear("current") || clear("desired") ? "CLARIFY" : "EXPLORE";
  const next = dimensions.find((item) => item.state === "UNCLEAR") ?? dimensions.find((item) => item.state === "DEVELOPING");
  const reason = next ? questionPurpose(next.key) : "The strategic model is coherent enough to review as a whole.";
  return { stage, dimensions, next, reason, ready: stage === "READY" || stage === "SYNTHESISE" };
}

function questionPurpose(key: string) {
  const copy: Record<string, string> = {
    current: "Life OS needs a shared picture of where you are before it can recommend a meaningful change.",
    desired: "Life OS understands that this area matters, but not yet what a good outcome looks like.",
    motivation: "Knowing why this matters helps Life OS distinguish a real priority from a passing preference.",
    constraints: "A useful strategy has to respect what you are not willing to sacrifice.",
    tradeoffs: "Life OS needs to understand which competing priorities you would protect if they conflict.",
    measurement: "A strategy needs an observable signal so that Life OS can tell whether it is working.",
    strategy: "The direction is taking shape; the remaining work is turning it into an approach you can act on."
  };
  return copy[key] ?? "This answer will make the next strategic decision more reliable.";
}
