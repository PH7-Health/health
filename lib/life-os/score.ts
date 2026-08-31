export type ScorePart = { label: string; expected: number; completed: number; weight: number };

export function calculateScore(parts: ScorePart[]) {
  const weightTotal = parts.reduce((total, part) => total + part.weight, 0);
  const score = weightTotal === 0 ? 0 : Math.round(parts.reduce((total, part) => total + (part.expected ? Math.min(part.completed / part.expected, 1) : 1) * part.weight, 0) / weightTotal * 100);
  const status = score >= 82 ? "ON_TRACK" : score >= 68 ? "WATCH" : score >= 50 ? "AT_RISK" : "OFF_TRACK";
  return { score, status, parts: parts.map((part) => ({ ...part, contribution: part.expected ? Math.round((part.completed / part.expected) * part.weight) : part.weight })) };
}
