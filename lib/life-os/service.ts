import { CompletionState, LifeStatus, TaskPriority } from "@prisma/client";

import { prisma } from "@/lib/db/prisma";
import { addDays, localDate, weekStart } from "./date";
import { calculateScore, type ScorePart } from "./score";
import { recalculatePathway } from "@/lib/intelligence/service";
import { getDeterministicWeeklyIntelligence } from "@/lib/intelligence/service";

const areas = [
  ["health", "Health", 25], ["work", "pH7 / Work", 20], ["wealth", "Wealth", 12], ["relationships", "Relationships", 12], ["social", "Friends / Social", 8], ["development", "Personal Development", 7], ["environment", "Home / Environment", 6], ["adventure", "Adventure / Travel", 4], ["contribution", "Mentoring / Contribution", 3], ["fun", "Fun", 3]
] as const;
const metrics = [
  ["weight", "Weight", "NUMBER", "kg", "body", false], ["sleep_duration", "Sleep duration", "NUMBER", "h", "sleep", true], ["sleep_quality", "Sleep quality", "SCALE_1_10", null, "sleep", true], ["steps", "Steps", "NUMBER", "steps", "activity", true], ["protein", "Protein", "NUMBER", "g", "nutrition", true], ["mood", "Mood", "SCALE_1_10", null, "subjective", true], ["energy", "Energy", "SCALE_1_10", null, "subjective", true], ["focus", "Focus", "SCALE_1_10", null, "subjective", true]
] as const;

export async function ensureLifeOsSeed(userId: string) {
  if (await prisma.lifeArea.count({ where: { userId } })) return;
  const created = await Promise.all(areas.map(([key, name, weight], sortOrder) => prisma.lifeArea.create({ data: { userId, key, name, weight, sortOrder } })));
  const byKey = new Map(created.map((area) => [area.key, area.id]));
  const healthObjective = await prisma.objective.create({ data: { userId, lifeAreaId: byKey.get("health")!, title: "Build a durable health baseline", description: "Prioritise sleep, movement, nutrition, and recovery." } });
  const workObjective = await prisma.objective.create({ data: { userId, lifeAreaId: byKey.get("work")!, title: "Protect focused, meaningful work", description: "Choose one outcome and make deliberate progress." } });
  await prisma.keyResult.createMany({ data: [{ userId, objectiveId: healthObjective.id, title: "Maintain an evidence-based weekly health rhythm" }, { userId, objectiveId: workObjective.id, title: "Complete the week’s highest-leverage work" }] });
  await prisma.metricDefinition.createMany({ data: metrics.map(([key, name, valueType, unit, category, important]) => ({ userId, key, name, valueType, unit, category, important })) });
  await prisma.habit.createMany({ data: [
    { userId, lifeAreaId: byKey.get("health")!, objectiveId: healthObjective.id, key: "training", name: "Move with intent", targetCount: 1, scoreWeight: 1.4 },
    { userId, lifeAreaId: byKey.get("health")!, objectiveId: healthObjective.id, key: "nutrition", name: "Meet nutrition target", targetCount: 1, scoreWeight: 1 },
    { userId, lifeAreaId: byKey.get("work")!, objectiveId: workObjective.id, key: "deep_work", name: "Focused work block", targetCount: 1, scoreWeight: 1.3 },
    { userId, lifeAreaId: byKey.get("relationships")!, key: "connection", name: "Intentional connection", targetCount: 1, scoreWeight: 1 },
    { userId, lifeAreaId: byKey.get("environment")!, key: "reset", name: "Ten-minute reset", targetCount: 1, scoreWeight: 0.7 }
  ] });
  await prisma.supplement.createMany({ data: [
    { userId, name: "Creatine", intendedDose: 5, doseUnit: "g", normalTime: "Morning" },
    { userId, name: "Vitamin D3", intendedDose: 1, doseUnit: "dose", normalTime: "Morning" },
    { userId, name: "Magnesium", intendedDose: 1, doseUnit: "dose", normalTime: "Evening" }
  ] });
  await prisma.task.createMany({ data: [
    { userId, lifeAreaId: byKey.get("work")!, objectiveId: workObjective.id, title: "Define today’s most important outcome", priority: "MOST_IMPORTANT" },
    { userId, lifeAreaId: byKey.get("work")!, title: "Review critical commitments", priority: "CRITICAL" },
    { userId, lifeAreaId: byKey.get("development")!, title: "Plan tomorrow’s first move", priority: "SECONDARY" }
  ] });
  await prisma.alertRule.create({ data: { userId, key: "low_score_three_days", name: "Three-day score drift", severity: "AT_RISK", config: { threshold: 60, days: 3 } } });
  await prisma.notificationPreference.createMany({ data: [{ userId, channel: "email", eventType: "drift", enabled: true, minSeverity: "WATCH" }, { userId, channel: "email", eventType: "weekly_review", enabled: true, minSeverity: "INFO" }] });
}

export async function getTodayView(userId: string, requestedDate?: Date) {
  await ensureLifeOsSeed(userId);
  const date = requestedDate ?? localDate();
  const [areas, objectives, metrics, scoreMetrics, entries, habits, habitCompletions, supplements, supplementLogs, tasks, taskCompletions, checkIn] = await Promise.all([
    prisma.lifeArea.findMany({ where: { userId, active: true }, orderBy: { sortOrder: "asc" } }),
    prisma.objective.findMany({ where: { userId, active: true }, include: { keyResults: true } }),
    prisma.metricDefinition.findMany({ where: { userId, active: true, showInCheckIn: true }, orderBy: { name: "asc" } }),
    prisma.metricDefinition.findMany({ where: { userId, active: true, useInScore: true }, orderBy: { name: "asc" } }),
    prisma.metricEntry.findMany({ where: { userId, localDate: date } }),
    prisma.habit.findMany({ where: { userId, active: true, showToday: true }, include: { lifeArea: true, schedules: true }, orderBy: { name: "asc" } }),
    prisma.habitCompletion.findMany({ where: { userId, localDate: date } }),
    prisma.supplement.findMany({ where: { userId, active: true, OR: [{ startDate: null }, { startDate: { lte: date } }], AND: [{ OR: [{ endDate: null }, { endDate: { gte: date } }] }] }, include: { schedules: true }, orderBy: { name: "asc" } }),
    prisma.supplementLog.findMany({ where: { userId, localDate: date } }),
    prisma.task.findMany({ where: { userId, active: true, showToday: true }, include: { lifeArea: true, recurrenceRule: true }, orderBy: { priority: "asc" } }),
    prisma.taskCompletion.findMany({ where: { userId, localDate: date } }),
    prisma.dailyCheckIn.findUnique({ where: { userId_localDate: { userId, localDate: date } } })
  ]);
  const scheduledHabits = habits.filter((habit) => isScheduled(habit.schedules, date));
  const scheduledSupplements = supplements.filter((supplement) => isScheduled(supplement.schedules, date));
  const scheduledTasks = tasks.filter((task) => isScheduled(task.recurrenceRule ? [{ daysOfWeek: task.recurrenceRule.daysOfWeek }] : [], date));
  const isToday = date.getTime() === localDate().getTime();
  const fallback = isToday ? await recalculateScore(userId, date, areas, { habits: scheduledHabits, habitCompletions, supplements: scheduledSupplements, supplementLogs, tasks: scheduledTasks, taskCompletions, scoreMetrics, entries }) : await historicalScore(userId, date);
  const alerts = isToday ? await evaluateDrift(userId, date) : await prisma.alertEvent.findMany({ where: { userId, localDate: date, resolvedAt: null } });
  return { date, isToday, areas, objectives, metrics, scoreMetrics, entries, habits: scheduledHabits, habitCompletions, supplements: scheduledSupplements, supplementLogs, tasks: scheduledTasks, taskCompletions, checkIn, ...fallback, alerts };
}

async function historicalScore(userId: string, date: Date) { const score = await prisma.dailyScore.findUnique({ where: { userId_localDate: { userId, localDate: date } } }); if (!score) return { score: 0, status: "OFF_TRACK" as LifeStatus, summary: "No recorded score for this day.", parts: [] }; return { score: score.score, status: score.status, summary: score.summary, parts: await prisma.dailyScoreComponent.findMany({ where: { dailyScoreId: score.id }, select: { label: true, expected: true, completed: true, weight: true, contribution: true, details: true } }) }; }

type ScoreInputs = { habits: Array<{ id: string; affectsScore: boolean; lifeAreaId: string; lifeArea: { name: string } }>; habitCompletions: Array<{ habitId: string; state: CompletionState }>; supplements: Array<{ id: string }>; supplementLogs: Array<{ supplementId: string; state: CompletionState }>; tasks: Array<{ id: string; scoreRelevant: boolean; lifeAreaId: string | null }>; taskCompletions: Array<{ taskId: string; state: CompletionState }>; scoreMetrics: Array<{ id:string; name:string; defaultTarget:number|null; targetMin:number|null; targetMax:number|null; targetDirection:string; valueType:string }>; entries:Array<{metricDefinitionId:string;valueNumber:number|null;valueBoolean:boolean|null}> };

async function recalculateScore(userId: string, date: Date, areas: Array<{ id: string; name: string; key: string; weight: number }>, state: ScoreInputs) {
  const grouped = new Map(areas.map((area) => [area.id, { label: area.name, expected: 0, completed: 0, weight: area.weight }]));
  const add = (areaId: string | undefined, isComplete: boolean) => { if (!areaId || !grouped.has(areaId)) return; const value = grouped.get(areaId)!; value.expected += 1; if (isComplete) value.completed += 1; };
  for (const habit of state.habits.filter((habit) => habit.affectsScore)) add(habit.lifeAreaId, state.habitCompletions.some((item) => item.habitId === habit.id && item.state === "COMPLETED"));
  const healthArea = areas.find((area) => area.key === "health")?.id;
  for (const supplement of state.supplements) add(healthArea, state.supplementLogs.some((item) => item.supplementId === supplement.id && item.state === "COMPLETED"));
  for (const task of state.tasks.filter((task) => task.scoreRelevant)) add(task.lifeAreaId ?? areas.find((area) => area.key === "work")?.id, state.taskCompletions.some((item) => item.taskId === task.id && item.state === "COMPLETED"));
  const parts: ScorePart[] = [...grouped.values()].filter((part) => part.expected > 0 && part.weight > 0);
  const metricDetails = new Map<string, ReturnType<typeof metricEvaluation>>();
  for (const metric of state.scoreMetrics) {
    const evaluation = metricEvaluation(metric, state.entries.find((item) => item.metricDefinitionId === metric.id));
    if (!evaluation) continue;
    const label = `Metric · ${metric.name}`;
    metricDetails.set(label, evaluation);
    parts.push({ label, expected: 100, completed: Math.round(evaluation.ratio * 100), weight: Math.max(1, areas.find((area) => area.key === "health")?.weight ?? 1) });
  }
  const result = calculateScore(parts);
  const summary = result.score >= 82 ? "The core loop is holding." : result.score >= 68 ? "A few deliberate actions will steady the day." : "Protect one recovery action and one meaningful commitment.";
  const status = result.status as LifeStatus;
  const dailyScore = await prisma.dailyScore.upsert({ where: { userId_localDate: { userId, localDate: date } }, update: { score: result.score, status, summary, snapshot: result }, create: { userId, localDate: date, score: result.score, status, summary, snapshot: result } });
  await prisma.dailyScoreComponent.deleteMany({ where: { dailyScoreId: dailyScore.id } });
  const explainedParts = result.parts.map((part) => ({ ...part, details: metricDetails.get(part.label) ?? null }));
  if (explainedParts.length) await prisma.dailyScoreComponent.createMany({ data: explainedParts.map((part) => ({ dailyScoreId: dailyScore.id, ...part, details: part.details ?? undefined })) });
  return { ...result, parts: explainedParts, summary };
}

function metricEvaluation(metric: ScoreInputs["scoreMetrics"][number], entry: ScoreInputs["entries"][number] | undefined) {
  if (!entry) return null;
  if (metric.valueType === "BOOLEAN") return { ratio: entry.valueBoolean ? 1 : 0, target: "Complete", actual: entry.valueBoolean ? "Complete" : "Not completed", reason: entry.valueBoolean ? "Boolean target completed." : "Boolean target not completed." };
  const value = entry.valueNumber;
  if (value == null) return null;
  const display = (number: number) => String(Number(number.toFixed(2)));
  if (metric.targetMin != null && metric.targetMax != null) {
    const ratio = value >= metric.targetMin && value <= metric.targetMax ? 1 : value < metric.targetMin ? Math.max(0, value / metric.targetMin) : Math.max(0, metric.targetMax / value);
    return { ratio, target: `${display(metric.targetMin)}–${display(metric.targetMax)}`, actual: display(value), reason: value >= metric.targetMin && value <= metric.targetMax ? "Within the configured target range." : value < metric.targetMin ? "Below the configured minimum." : "Above the configured maximum." };
  }
  const target = metric.defaultTarget ?? metric.targetMin ?? metric.targetMax;
  if (!target) return null;
  const decrease = metric.targetDirection === "DECREASE" || metric.targetMax != null;
  const ratio = decrease ? Math.min(1, target / Math.max(value, 0.0001)) : Math.min(1, value / target);
  return { ratio, target: `${decrease ? "≤" : "≥"} ${display(target)}`, actual: display(value), reason: ratio === 1 ? "Configured target reached." : decrease ? "Above the configured maximum." : "Below the configured minimum." };
}

export async function evaluateDrift(userId: string, date = localDate()) {
  const rule = await prisma.alertRule.findUnique({ where: { userId_key: { userId, key: "low_score_three_days" } } });
  if (!rule || !rule.active) return prisma.alertEvent.findMany({ where: { userId, resolvedAt: null, localDate: date } });
  const config = rule.config as { threshold?: number; days?: number; recommendedAction?: string };
  const days = Math.max(1, Math.min(30, Number(config.days ?? 3)));
  const threshold = Math.max(0, Math.min(100, Number(config.threshold ?? 60)));
  const scores = await prisma.dailyScore.findMany({ where: { userId, localDate: { gte: addDays(date, 1 - days), lte: date } }, orderBy: { localDate: "asc" } });
  if (scores.length < days || scores.reduce((sum, item) => sum + item.score, 0) / scores.length >= threshold) return prisma.alertEvent.findMany({ where: { userId, resolvedAt: null, localDate: date } });
  const observed = Math.round(scores.reduce((sum, item) => sum + item.score, 0) / scores.length);
  await prisma.alertEvent.upsert({ where: { userId_fingerprint_localDate: { userId, fingerprint: "low-score-three-days", localDate: date } }, update: {}, create: { userId, alertRuleId: rule.id, localDate: date, status: "AT_RISK", title: rule.name, explanation: `The rolling score has remained below ${threshold} for ${days} days.`, expectedValue: `${threshold} or above`, observedValue: String(observed), period: `Last ${days} days`, recommendedAction: config.recommendedAction || "Choose one health action and one essential task, then reduce optional commitments.", fingerprint: "low-score-three-days" } });
  return prisma.alertEvent.findMany({ where: { userId, resolvedAt: null, localDate: date } });
}

export async function setCompletion(userId: string, type: "task" | "habit" | "supplement", id: string) {
  const date = localDate();
  if (type === "task") await prisma.taskCompletion.upsert({ where: { userId_taskId_localDate: { userId, taskId: id, localDate: date } }, update: { state: "COMPLETED" }, create: { userId, taskId: id, localDate: date } });
  if (type === "habit") await prisma.habitCompletion.upsert({ where: { userId_habitId_localDate: { userId, habitId: id, localDate: date } }, update: { state: "COMPLETED" }, create: { userId, habitId: id, localDate: date } });
  if (type === "supplement") { const supplement = await prisma.supplement.findFirst({ where: { id, userId } }); if (supplement) await prisma.supplementLog.upsert({ where: { userId_supplementId_localDate: { userId, supplementId: id, localDate: date } }, update: { state: "COMPLETED" }, create: { userId, supplementId: id, localDate: date, configurationSnapshot: { name: supplement.name, intendedDose: supplement.intendedDose, doseUnit: supplement.doseUnit, normalTime: supplement.normalTime, frequency: supplement.frequency } } }); }
  await getTodayView(userId);
}

export async function addTask(userId: string, title: string, priority: TaskPriority) {
  if (!title.trim()) return;
  await prisma.task.create({ data: { userId, title: title.trim(), priority } });
}

export async function saveCheckIn(userId: string, fields: Record<string, FormDataEntryValue>) {
  const date = localDate();
  const definitions = await prisma.metricDefinition.findMany({ where: { userId, active: true } });
  await Promise.all(definitions.flatMap((definition) => {
    const raw = fields[definition.key]; if (typeof raw !== "string" || raw.trim() === "") return [];
    const value = definition.valueType === "BOOLEAN" ? { valueBoolean: raw === "true", valueNumber: null, valueText: null } : definition.valueType === "TEXT" || definition.valueType === "SELECT" ? { valueText: raw, valueNumber: null, valueBoolean: null } : Number.isNaN(Number(raw)) ? null : { valueNumber: Number(raw), valueText: null, valueBoolean: null };
    if (!value) return [];
    return prisma.metricEntry.upsert({ where: { userId_metricDefinitionId_localDate: { userId, metricDefinitionId: definition.id, localDate: date } }, update: value, create: { userId, metricDefinitionId: definition.id, localDate: date, ...value } });
  }));
  await prisma.dailyCheckIn.upsert({ where: { userId_localDate: { userId, localDate: date } }, update: { reflection: String(fields.reflection ?? "").trim() || null, completedAt: new Date() }, create: { userId, localDate: date, timezone: "Europe/Lisbon", reflection: String(fields.reflection ?? "").trim() || null, completedAt: new Date() } });
  await getTodayView(userId);
  const pathways = await prisma.goalPathway.findMany({ where: { userId, status: "ACTIVE" }, select: { id: true } });
  await Promise.all(pathways.map((pathway) => recalculatePathway(userId, pathway.id)));
}

export async function getDashboardView(userId: string) {
  const today = await getTodayView(userId);
  const scores = await prisma.dailyScore.findMany({ where: { userId, localDate: { gte: addDays(today.date, -29) } }, orderBy: { localDate: "asc" } });
  return { ...today, scores, seven: scores.slice(-7), thirty: scores, average7: average(scores.slice(-7).map((item) => item.score)), average30: average(scores.map((item) => item.score)) };
}

export async function getWeeklyReview(userId: string) {
  const start = weekStart(); const end = addDays(start, 6);
  const scores = await prisma.dailyScore.findMany({ where: { userId, localDate: { gte: start, lte: end } }, include: { components: true } });
  const averageScore = Math.round(average(scores.map((item) => item.score)));
  const components = new Map<string, number[]>();
  scores.forEach((score) => score.components.forEach((part) => components.set(part.label, [...(components.get(part.label) ?? []), part.contribution])));
  const ranked = [...components.entries()].map(([label, values]) => ({ label, value: average(values) })).sort((a, b) => b.value - a.value);
  const neglected = (await prisma.lifeArea.findMany({ where: { userId, active: true } })).filter((area) => !ranked.some((item) => item.label === area.name)).map((area) => ({ area: area.name, reason: "No scored leading action this week." }));
  const intelligence = await getDeterministicWeeklyIntelligence(userId);
  const combinedNeglected = [...new Map([...neglected, ...intelligence.neglected.map((area) => ({ area, reason: "No linked behaviour is configured." }))].map((item) => [item.area, item])).values()];
  const data = { userId, weekStart: start, weekEnd: end, overallScore: averageScore, strongestArea: ranked[0]?.label, weakestArea: ranked.at(-1)?.label, improved: intelligence.improved, deteriorated: intelligence.deteriorated, neglected: combinedNeglected, recommendations: [{ title: intelligence.recommendation.title, severity: intelligence.deteriorated.length || combinedNeglected.length ? "WATCH" : "INFO", detail: intelligence.recommendation.detail }], snapshot: { scores: scores.map((item) => ({ date: item.localDate, score: item.score })), intelligence } };
  return prisma.weeklyReview.upsert({ where: { userId_weekStart: { userId, weekStart: start } }, update: data, create: data });
}

export async function saveWeeklyReflection(userId: string, reflection: string) { const review = await getWeeklyReview(userId); return prisma.weeklyReview.update({ where: { id: review.id }, data: { reflection } }); }

export async function persistInboundEmail(userId: string, input: { sender?: string; subject: string; bodyText: string; provider?: string; providerMessageId?: string }) {
  const message = await prisma.emailMessage.create({ data: { userId, direction: "INBOUND", messageType: "check_in_reply", subject: input.subject, bodyText: input.bodyText, sender: input.sender, provider: input.provider, providerMessageId: input.providerMessageId } });
  const matches = [{ fieldKey: "sleep_duration", regex: /slept\s+(\d+(?:\.\d+)?)/i }, { fieldKey: "mood", regex: /mood\s+(\d+)/i }, { fieldKey: "energy", regex: /energy\s+(\d+)/i }, { fieldKey: "steps", regex: /steps\s+(\d+)/i }].flatMap((pattern) => { const hit = input.bodyText.match(pattern.regex); return hit ? [{ ...pattern, rawValue: hit[0], value: Number(hit[1]) }] : []; });
  await Promise.all(matches.flatMap((match) => [prisma.emailParsedEntry.create({ data: { userId, emailMessageId: message.id, fieldKey: match.fieldKey, rawValue: match.rawValue, parsedValue: { value: match.value }, confidence: 0.85 } }), prisma.emailMutation.create({ data: { userId, emailMessageId: message.id, targetModel: "MetricEntry", operation: "upsert", payload: { key: match.fieldKey, value: match.value }, status: "PROPOSED" } })]));
  return { message, parsedCount: matches.length };
}

const average = (values: number[]) => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;

function isScheduled(schedules: Array<{ daysOfWeek: unknown }>, date: Date) {
  if (!schedules.length || schedules.every((schedule) => !Array.isArray(schedule.daysOfWeek) || schedule.daysOfWeek.length === 0)) return true;
  return schedules.some((schedule) => Array.isArray(schedule.daysOfWeek) && schedule.daysOfWeek.map(Number).includes(date.getDay()));
}
