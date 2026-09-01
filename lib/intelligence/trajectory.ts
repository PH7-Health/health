export type Confidence = "HIGH" | "MEDIUM" | "LOW" | "INSUFFICIENT_DATA";
export type Trajectory = "AHEAD" | "ON_TRACK" | "WATCH" | "BEHIND" | "STALLED" | "INSUFFICIENT_DATA";
export type Measurement = { date: Date; value: number };

export function progressPercent(baseline: number, target: number, current: number) {
  const distance = target - baseline;
  if (!distance) return current === target ? 100 : 0;
  return Math.max(0, Math.min(100, (current - baseline) / distance * 100));
}

export function velocityPerDay(points: Measurement[]) {
  if (points.length < 2) return null;
  const sorted = [...points].sort((a, b) => a.date.getTime() - b.date.getTime());
  const first = sorted[0]; const last = sorted.at(-1)!;
  const days = (last.date.getTime() - first.date.getTime()) / 86_400_000;
  return days >= 7 ? (last.value - first.value) / days : null;
}

export function estimateTrajectory({ baseline, target, current, points, desiredDate, now = new Date() }: { baseline: number; target: number; current: number; points: Measurement[]; desiredDate?: Date | null; now?: Date }) {
  const velocity = velocityPerDay(points);
  const progress = progressPercent(baseline, target, current);
  if (velocity == null) return { progress, velocity: null, status: "INSUFFICIENT_DATA" as Trajectory, confidence: "INSUFFICIENT_DATA" as Confidence, low: null, high: null, basis: "Fewer than two measurements spanning seven days." };
  const remaining = target - current;
  const improving = Math.sign(remaining) === Math.sign(velocity) || remaining === 0;
  if (Math.abs(velocity) < Math.max(Math.abs(target - baseline) * 0.002, 0.0001)) return { progress, velocity, status: "STALLED" as Trajectory, confidence: points.length >= 4 ? "MEDIUM" as Confidence : "LOW" as Confidence, low: null, high: null, basis: "Recent movement is too small to support a useful completion estimate." };
  if (!improving) return { progress, velocity, status: "BEHIND" as Trajectory, confidence: points.length >= 4 ? "MEDIUM" as Confidence : "LOW" as Confidence, low: null, high: null, basis: "The recent trend is moving away from the target." };
  const days = Math.max(0, remaining / velocity);
  const low = new Date(now); low.setDate(low.getDate() + Math.floor(days * 0.8));
  const high = new Date(now); high.setDate(high.getDate() + Math.ceil(days * 1.25));
  const confidence: Confidence = points.length >= 8 && (points.at(-1)!.date.getTime() - points[0].date.getTime()) >= 28 * 86_400_000 ? "MEDIUM" : "LOW";
  let status: Trajectory = "ON_TRACK";
  if (desiredDate) { const required = (target - current) / Math.max(1, (desiredDate.getTime() - now.getTime()) / 86_400_000); status = Math.abs(velocity) >= Math.abs(required) ? "ON_TRACK" : Math.abs(velocity) >= Math.abs(required) * .7 ? "WATCH" : "BEHIND"; }
  return { progress, velocity, status, confidence, low, high, basis: `${points.length} measurements over ${Math.round((points.at(-1)!.date.getTime() - points[0].date.getTime()) / 86_400_000)} days; estimate is a range, not a promise.` };
}

export function milestoneComplete(direction: string, actual: number, target: number) { return direction === "DECREASE" ? actual <= target : actual >= target; }
