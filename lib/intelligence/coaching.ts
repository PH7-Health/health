import { prisma } from "@/lib/db/prisma";
import { localDate, weekStart } from "@/lib/life-os/date";
import { getTodayView, getWeeklyReview } from "@/lib/life-os/service";
import { generateAskLifeOs, generateWeeklyCoaching } from "./provider";
import type { WeeklyCoaching } from "./coaching-schema";

export async function buildCoachingBrief(userId: string, scope?: { pathwayId?: string; lifeAreaId?: string }) {
  const today = await getTodayView(userId);
  const pathways = await prisma.goalPathway.findMany({
    where: { userId, status: "ACTIVE", ...(scope?.pathwayId ? { id: scope.pathwayId } : {}) },
    include: {
      objective: { include: { lifeArea: true } }, milestones: { orderBy: { sequence: "asc" } },
      metrics: { where: { active: true }, include: { metricDefinition: { include: { entries: { where: { userId, localDate: { gte: new Date(Date.now() - 21 * 86400000) } }, orderBy: { localDate: "desc" }, take: 8 } } } } },
      trajectorySnapshots: { orderBy: { localDate: "desc" }, take: 1 }
    }
  });
  const [insights, recommendations] = await Promise.all([prisma.insight.findMany({ where: { userId, ...(scope?.pathwayId ? { pathwayId: scope.pathwayId } : {}) }, orderBy: { createdAt: "desc" }, take: 5 }), prisma.recommendation.findMany({ where: { userId, active: true, ...(scope?.pathwayId ? { pathwayId: scope.pathwayId } : {}) }, orderBy: { updatedAt: "desc" }, take: 4 })]);
  return { date: localDate().toISOString().slice(0, 10), scope: scope ?? {}, today: { score: today.score, status: today.status, alerts: today.alerts.map((alert) => ({ title: alert.title, observed: alert.observedValue, expected: alert.expectedValue })), remainingActions: today.tasks.length + today.habits.length + today.supplements.length - today.taskCompletions.length - today.habitCompletions.length - today.supplementLogs.length }, pathways: pathways.map((pathway) => ({ lifeArea: pathway.objective.lifeArea.name, objective: pathway.objective.title, current: pathway.currentDescription, desired: pathway.desiredDescription, constraints: pathway.constraints, direction: pathway.direction, nextMilestone: pathway.milestones.find((item) => item.status === "ACTIVE")?.title ?? null, trajectory: pathway.trajectorySnapshots[0] ? { status: pathway.trajectorySnapshots[0].status, confidence: pathway.trajectorySnapshots[0].confidence, progress: pathway.trajectorySnapshots[0].progressPercent, basis: pathway.trajectorySnapshots[0].basis } : null, limiter: pathway.limiterExplanation, metrics: pathway.metrics.map((binding) => ({ name: binding.metricDefinition.name, unit: binding.metricDefinition.unit, entries: binding.metricDefinition.entries.map((entry) => ({ date: entry.localDate.toISOString().slice(0, 10), value: entry.valueNumber ?? entry.valueBoolean ?? entry.valueText })) })) })), insights: insights.map((item) => ({ title: item.title, explanation: item.explanation, confidence: item.confidence })), recommendations: recommendations.map((item) => ({ title: item.title, explanation: item.explanation, confidence: item.confidence })) };
}

export async function buildWeeklyEvidence(userId: string) { const review = await getWeeklyReview(userId); const pathways = await buildCoachingBrief(userId); return { weekStart: weekStart().toISOString().slice(0, 10), deterministicReview: { overallScore: review.overallScore, strongestArea: review.strongestArea, weakestArea: review.weakestArea, improved: review.improved, deteriorated: review.deteriorated, neglected: review.neglected, recommendations: review.recommendations }, pathways }; }

export async function askLifeOs(userId: string, question: string, scope?: { pathwayId?: string; lifeAreaId?: string }, followUps: Array<{ question: string; answer: string }> = []) {
  if (!question.trim()) throw new Error("Ask a specific question.");
  const brief = await buildCoachingBrief(userId, scope); const result = await generateAskLifeOs({ question: question.trim(), brief, followUps: followUps.slice(-2) });
  await prisma.aIExecution.create({ data: { userId, provider: result.provider, model: result.model, operation: "ask_life_os", schemaVersion: "coaching-v1", inputWindow: { scope: scope ?? {}, question: question.trim(), contextVersion: "brief-v1" }, output: { requestId: result.requestId, validation: "PASS", answer: result.output } } });
  return result.output;
}

export async function generateWeeklyCoach(userId: string): Promise<WeeklyCoaching> {
  const existing = await prisma.aIExecution.findFirst({ where: { userId, operation: "weekly_coaching", createdAt: { gte: weekStart() } }, orderBy: { createdAt: "desc" } });
  if (existing?.output && typeof existing.output === "object" && "answer" in existing.output) return (existing.output as { answer: WeeklyCoaching }).answer;
  const evidence = await buildWeeklyEvidence(userId); const result = await generateWeeklyCoaching(evidence);
  await prisma.aIExecution.create({ data: { userId, provider: result.provider, model: result.model, operation: "weekly_coaching", schemaVersion: "coaching-v1", inputWindow: { weekStart: evidence.weekStart, contextVersion: "weekly-evidence-v1" }, output: { requestId: result.requestId, validation: "PASS", answer: result.output } } });
  return result.output;
}
