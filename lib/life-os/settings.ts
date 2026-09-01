import { prisma } from "@/lib/db/prisma";

export async function getSettingsView(userId: string) {
  const [areas, objectives, metrics, habits, supplements, tasks, rules, notifications] = await Promise.all([
    prisma.lifeArea.findMany({ where: { userId }, include: { objectives: { include: { keyResults: { where: { active: true } } } }, habits: true, tasks: true }, orderBy: { sortOrder: "asc" } }),
    prisma.objective.findMany({ where: { userId }, include: { lifeArea: true, keyResults: { include: { metricDefinition: true } } }, orderBy: [{ active: "desc" }, { priority: "asc" }] }),
    prisma.metricDefinition.findMany({ where: { userId }, orderBy: [{ active: "desc" }, { category: "asc" }, { name: "asc" }] }),
    prisma.habit.findMany({ where: { userId }, include: { lifeArea: true, objective: true, schedules: true }, orderBy: [{ active: "desc" }, { name: "asc" }] }),
    prisma.supplement.findMany({ where: { userId }, include: { schedules: true }, orderBy: [{ active: "desc" }, { name: "asc" }] }),
    prisma.task.findMany({ where: { userId }, include: { lifeArea: true, objective: true, recurrenceRule: true }, orderBy: [{ active: "desc" }, { title: "asc" }] }),
    prisma.alertRule.findMany({ where: { userId }, orderBy: [{ active: "desc" }, { name: "asc" }] }),
    prisma.notificationPreference.findMany({ where: { userId }, orderBy: { eventType: "asc" } })
  ]);
  const active = <T extends { active: boolean }>(items: T[]) => items.filter((item) => item.active).length;
  const summary = {
    areas: active(areas), objectives: active(objectives), keyResults: objectives.flatMap((item) => item.keyResults).filter((item) => item.active).length,
    behaviours: active(habits), metrics: active(metrics), supplements: active(supplements), recurringActions: tasks.filter((item) => item.active && item.recurrenceRule).length,
    driftRules: active(rules), weightTotal: areas.filter((item) => item.active).reduce((sum, item) => sum + item.weight, 0)
  };
  return { areas, objectives, metrics, habits, supplements, tasks, rules, notifications, summary };
}

export function scheduleDays(value: unknown) {
  return Array.isArray(value) ? value.map(Number).filter((day) => Number.isInteger(day) && day >= 0 && day <= 6) : [];
}

export function formatSchedule(days: unknown, frequency = "DAILY") {
  const selected = scheduleDays(days);
  if (!selected.length) return frequency.toLowerCase();
  return selected.map((day) => ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][day]).join(", ");
}

export function describeDriftRule(config: unknown) {
  const value = (config ?? {}) as { threshold?: number; days?: number; recommendedAction?: string };
  const days = value.days ?? 3;
  const threshold = value.threshold ?? 60;
  return `Triggers when the rolling score stays below ${threshold}/100 for ${days} consecutive days.`;
}
