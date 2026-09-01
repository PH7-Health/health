export type CandidateMetric = { id: string; name: string; unit: string | null; valueType: string; category?: string | null; direction?: string | null };
export type SuggestedMetric = { name: string; unit: string | null; direction: "INCREASE" | "DECREASE"; frequency: "DAILY" | "WEEKLY" | "AS_NEEDED"; rationale: string; existingMetricId: string | null };
const tokens = (value: string): string[] => value.toLowerCase().match(/[a-z0-9]+/g) ?? [];
const outcomeWords = new Set(["5k", "run", "running", "time", "weight", "body", "sleep", "steps"]);

export function selectPrimaryMetric(input: { desired: string; unit: string | null; direction: string }, candidates: CandidateMetric[], suggestions: SuggestedMetric[]): SuggestedMetric {
  const desiredTokens = tokens(input.desired).filter((token) => outcomeWords.has(token));
  const ranked = candidates.map((metric) => ({ metric, score: compatibilityScore(input, desiredTokens, metric) })).filter((item) => item.score >= 100).sort((a, b) => b.score - a.score || a.metric.name.localeCompare(b.metric.name));
  if (ranked[0]) return { name: ranked[0].metric.name, unit: ranked[0].metric.unit, direction: input.direction === "DECREASE" ? "DECREASE" : "INCREASE", frequency: "WEEKLY", rationale: "Existing metric is deterministically compatible with this pathway outcome.", existingMetricId: ranked[0].metric.id };
  const suggested = suggestions.find((item) => !item.existingMetricId && item.direction === input.direction && (!input.unit || item.unit?.toLowerCase() === input.unit.toLowerCase()));
  return suggested ? { ...suggested, unit: input.unit ?? suggested.unit } : { name: `${input.desired} progress`, unit: input.unit, direction: input.direction === "DECREASE" ? "DECREASE" : "INCREASE", frequency: "WEEKLY", rationale: "No compatible existing metric exists; create a dedicated outcome metric.", existingMetricId: null };
}

function compatibilityScore(input: { unit: string | null; direction: string }, desiredTokens: string[], metric: CandidateMetric) {
  if (input.unit && metric.unit?.toLowerCase() !== input.unit.toLowerCase()) return -1;
  if (!input.unit && metric.unit) return -1;
  if (!["NUMBER", "INTEGER", "DECIMAL", "DURATION"].includes(metric.valueType)) return -1;
  if (metric.direction && metric.direction !== "NONE" && metric.direction !== input.direction) return -1;
  const nameTokens = tokens(`${metric.name} ${metric.category ?? ""}`); const overlap = desiredTokens.filter((token) => nameTokens.includes(token)).length;
  if (!overlap) return -1;
  return 100 + overlap * 10 + (metric.name.toLowerCase().includes("5k") ? 20 : 0);
}
