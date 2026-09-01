import { IntelligenceConfidence, MilestoneStatus, PathwayStatus, TrajectoryStatus } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { localDate } from "@/lib/life-os/date";
import { intelligenceProvider, IntelligenceProviderError, type PathwayProposal } from "./provider";
import { estimateTrajectory, milestoneComplete } from "./trajectory";
import { classifyInput, confidenceFor, detectTradeOff, trend, weeklyRecommendation } from "./analysis";

const confidence = (value: string) => value as IntelligenceConfidence;
const trajectory = (value: string) => value as TrajectoryStatus;

export async function createPathwayProposal(userId: string, input: { objectiveId: string; currentDescription: string; desiredDescription: string; constraints?: string; preferences?: string; baselineValue?: number; targetValue?: number; unit?: string; direction?: string; desiredDate?: string }) {
  const objective = await prisma.objective.findFirst({ where: { id: input.objectiveId, userId } });
  if (!objective) throw new Error("Objective not found");
  const direction = input.direction ?? "INCREASE";
  const availableMetrics = await prisma.metricDefinition.findMany({ where: { userId, active: true }, select: { id: true, name: true, unit: true, valueType: true, frequency: true } });
  let generated;
  try { generated = await intelligenceProvider.generatePathway({ current: input.currentDescription, desired: input.desiredDescription, baseline: input.baselineValue ?? null, target: input.targetValue ?? null, unit: input.unit ?? null, direction, constraints: input.constraints ?? null, metrics: availableMetrics }); } catch (error) { if (error instanceof IntelligenceProviderError) throw error; throw new Error("Pathway generation failed safely. Please retry."); }
  const result = validateProposal(generated.proposal, input);
  const pathway = await prisma.goalPathway.upsert({ where: { objectiveId: objective.id }, update: { currentDescription: input.currentDescription, desiredDescription: input.desiredDescription, constraints: input.constraints || null, preferences: input.preferences || null, baselineValue: input.baselineValue ?? null, targetValue: input.targetValue ?? null, unit: input.unit || null, direction, desiredDate: input.desiredDate ? new Date(`${input.desiredDate}T12:00:00.000Z`) : null, status: PathwayStatus.DRAFT }, create: { userId, objectiveId: objective.id, currentDescription: input.currentDescription, desiredDescription: input.desiredDescription, constraints: input.constraints || null, preferences: input.preferences || null, baselineValue: input.baselineValue ?? null, targetValue: input.targetValue ?? null, unit: input.unit || null, direction, desiredDate: input.desiredDate ? new Date(`${input.desiredDate}T12:00:00.000Z`) : null } });
  await prisma.milestone.deleteMany({ where: { pathwayId: pathway.id, status: MilestoneStatus.PENDING } });
  await prisma.milestone.createMany({ data: result.milestones.map((milestone, index) => ({ pathwayId: pathway.id, sequence: index + 1, title: milestone.title, description: milestone.rationale, targetValue: milestone.targetValue, unit: input.unit || null, status: index === 0 ? MilestoneStatus.ACTIVE : MilestoneStatus.PENDING })) });
  await prisma.pathwayAction.deleteMany({ where: { pathwayId: pathway.id } });
  await prisma.pathwayAction.createMany({ data: result.pathwayActions.map((action, index) => ({ pathwayId: pathway.id, title: action.title, rationale: action.rationale, expectedImpact: action.expectedImpact, priority: objective.priority + index })) });
  await prisma.aIExecution.create({ data: { userId, provider: generated.provider, model: generated.model, operation: "pathway_generation", schemaVersion: "v2", inputWindow: { ...input, metrics: availableMetrics }, output: result } });
  return prisma.aIProposal.create({ data: { userId, pathwayId: pathway.id, type: "PATHWAY", title: `Proposed pathway: ${objective.title}`, rationale: result.rationale, payload: result, provider: generated.provider, model: generated.model, schemaVersion: "v2", confidence: result.confidence } });
}

export async function resolveProposal(userId: string, proposalId: string, accept: boolean) {
  const proposal = await prisma.aIProposal.findFirst({ where: { id: proposalId, userId }, include: { pathway: true } });
  if (!proposal || !proposal.pathway) return;
  await prisma.aIProposal.update({ where: { id: proposal.id }, data: { status: accept ? "ACCEPTED" : "DISMISSED", resolvedAt: new Date() } });
  if (accept) {
    const payload = proposal.payload as unknown as PathwayProposal;
    const metric = payload.suggestedMetrics[0];
    if (metric) {
      const definition = metric.existingMetricId ? await prisma.metricDefinition.findFirst({ where: { id: metric.existingMetricId, userId } }) : await findOrCreateMetric(userId, metric);
      if (definition) await prisma.pathwayMetric.upsert({ where: { pathwayId_metricDefinitionId: { pathwayId: proposal.pathway.id, metricDefinitionId: definition.id } }, update: { rationale: metric.rationale, active: true }, create: { pathwayId: proposal.pathway.id, metricDefinitionId: definition.id, rationale: metric.rationale } });
    }
    await prisma.goalPathway.update({ where: { id: proposal.pathway.id }, data: { status: "ACTIVE", limiterTitle: payload.likelyLimiter.title, limiterExplanation: payload.likelyLimiter.explanation, limiterConfidence: payload.likelyLimiter.confidence } });
  }
}

export async function recalculatePathway(userId: string, pathwayId: string) {
  const pathway = await prisma.goalPathway.findFirst({ where: { id: pathwayId, userId }, include: { objective: true, milestones: { orderBy: { sequence: "asc" } } } });
  if (!pathway || pathway.baselineValue == null || pathway.targetValue == null) return null;
  const bound = await prisma.pathwayMetric.findFirst({ where: { pathwayId, active: true }, include: { metricDefinition: true } });
  const metric = bound?.metricDefinition;
  const entries = metric ? await prisma.metricEntry.findMany({ where: { userId, metricDefinitionId: metric.id, valueNumber: { not: null } }, orderBy: { localDate: "asc" }, take: 60 }) : [];
  const current = entries.at(-1)?.valueNumber ?? pathway.baselineValue;
  const estimate = estimateTrajectory({ baseline: pathway.baselineValue, target: pathway.targetValue, current, points: entries.map((entry) => ({ date: entry.localDate, value: entry.valueNumber! })), desiredDate: pathway.desiredDate });
  const active = pathway.milestones.find((milestone) => milestone.status === "ACTIVE");
  if (active?.targetValue != null && milestoneComplete(pathway.direction, current, active.targetValue)) { await prisma.milestone.update({ where: { id: active.id }, data: { status: "COMPLETED", completedAt: new Date() } }); const next = pathway.milestones.find((milestone) => milestone.sequence === active.sequence + 1); if (next) await prisma.milestone.update({ where: { id: next.id }, data: { status: "ACTIVE" } }); }
  await prisma.goalPathway.update({ where: { id: pathway.id }, data: { trajectoryStatus: trajectory(estimate.status), confidence: confidence(estimate.confidence), lastRecalculatedAt: new Date() } });
  await prisma.trajectorySnapshot.upsert({ where: { pathwayId_localDate: { pathwayId, localDate: localDate() } }, update: { progressPercent: estimate.progress, velocity: estimate.velocity, estimateLowDate: estimate.low, estimateHighDate: estimate.high, status: trajectory(estimate.status), confidence: confidence(estimate.confidence), basis: estimate.basis, snapshot: estimate }, create: { userId, pathwayId, localDate: localDate(), progressPercent: estimate.progress, velocity: estimate.velocity, estimateLowDate: estimate.low, estimateHighDate: estimate.high, status: trajectory(estimate.status), confidence: confidence(estimate.confidence), basis: estimate.basis, snapshot: estimate } });
  await refreshPathwayIntelligence(userId, pathwayId, estimate, current);
  return estimate;
}

async function refreshPathwayIntelligence(userId: string, pathwayId: string, estimate: ReturnType<typeof estimateTrajectory>, current: number) {
  const pathway = await prisma.goalPathway.findUniqueOrThrow({ where: { id: pathwayId }, include: { objective: true, milestones: { orderBy: { sequence: "asc" } } } });
  const next = pathway.milestones.find((item) => item.status === "ACTIVE");
  const title = estimate.status === "INSUFFICIENT_DATA" ? "More evidence is needed" : estimate.status === "STALLED" ? "Progress has stalled" : "Continue the current pathway";
  const explanation = estimate.status === "INSUFFICIENT_DATA" ? estimate.basis : estimate.status === "STALLED" ? `${estimate.basis} The current limiter is insufficient measurable movement, not a confirmed cause.` : `${estimate.basis} Current value: ${current}${pathway.unit ? ` ${pathway.unit}` : ""}.`;
  await prisma.insight.upsert({ where: { userId_fingerprint: { userId, fingerprint: `trajectory:${pathwayId}:${estimate.status}` } }, update: { title, explanation, evidence: estimate, confidence: confidence(estimate.confidence) }, create: { userId, pathwayId, type: estimate.status === "STALLED" ? "STALL" : estimate.status === "INSUFFICIENT_DATA" ? "DATA_QUALITY" : "PROGRESS", fingerprint: `trajectory:${pathwayId}:${estimate.status}`, title, explanation, evidence: estimate, confidence: confidence(estimate.confidence) } });
  await prisma.recommendation.upsert({ where: { userId_fingerprint: { userId, fingerprint: `pathway:${pathwayId}:next` } }, update: { title: estimate.status === "ON_TRACK" ? "Nothing to change" : next ? `Protect: ${next.title}` : "Review the next milestone", explanation: estimate.status === "ON_TRACK" ? "Available evidence remains consistent with the current pathway. Continue the strategy." : next ? `The next milestone is ${next.title}. Focus on the smallest linked action.` : explanation, confidence: confidence(estimate.confidence) }, create: { userId, pathwayId, fingerprint: `pathway:${pathwayId}:next`, title: estimate.status === "ON_TRACK" ? "Nothing to change" : next ? `Protect: ${next.title}` : "Review the next milestone", explanation: estimate.status === "ON_TRACK" ? "Available evidence remains consistent with the current pathway. Continue the strategy." : next ? `The next milestone is ${next.title}. Focus on the smallest linked action.` : explanation, confidence: confidence(estimate.confidence) } });
}

export async function getIntelligenceView(userId: string) {
  const [pathways, proposals, insights, recommendations] = await Promise.all([prisma.goalPathway.findMany({ where: { userId }, include: { objective: { include: { lifeArea: true } }, milestones: { orderBy: { sequence: "asc" } }, metrics: { where: { active: true }, include: { metricDefinition: true } }, actions: { where: { active: true }, orderBy: { priority: "asc" } }, trajectorySnapshots: { orderBy: { localDate: "desc" }, take: 1 } }, orderBy: { updatedAt: "desc" } }), prisma.aIProposal.findMany({ where: { userId, status: "PENDING" }, include: { pathway: true }, orderBy: { generatedAt: "desc" } }), prisma.insight.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take: 8 }), prisma.recommendation.findMany({ where: { userId, active: true }, orderBy: { updatedAt: "desc" }, take: 6 })]);
  return { pathways, proposals, insights, recommendations };
}

export async function getArchitectureView(userId: string) {
  const [areas, metrics, entries, habits, pathways, tasks] = await Promise.all([
    prisma.lifeArea.findMany({ where: { userId, active: true }, include: { objectives: { where: { active: true } } }, orderBy: { sortOrder: "asc" } }),
    prisma.metricDefinition.findMany({ where: { userId, active: true }, orderBy: { name: "asc" } }),
    prisma.metricEntry.findMany({ where: { userId, localDate: { gte: new Date(Date.now() - 30 * 86_400_000) } } }),
    prisma.habit.findMany({ where: { userId, active: true }, include: { objective: true } }),
    prisma.goalPathway.findMany({ where: { userId }, include: { metrics: true, milestones: { orderBy: { sequence: "asc" } } } }),
    prisma.task.findMany({ where: { userId, active: true, objectiveId: { not: null } } })
  ]);
  const inputValue = metrics.map((metric) => { const linked = pathways.some((pathway) => pathway.status === "ACTIVE" && pathway.metrics.some((binding) => binding.metricDefinitionId === metric.id && binding.active)); const logged = entries.filter((entry) => entry.metricDefinitionId === metric.id).length; const value = classifyInput({ pathwayLinked: linked, scoreRelevant: metric.useInScore, driftRelevant: metric.useInDrift, loggedCount: logged, frequency: metric.frequency }); return { metric, value, logged, linked, message: value === "LOW_VALUE" ? "Logged daily but it currently influences no active pathway, score, or drift rule." : value === "UNCONNECTED" ? "Not connected to an active pathway or current calculation." : value === "REQUIRED" ? "Directly measures an active pathway." : "Supports an existing score or drift calculation." }; });
  const numeric = (name: string) => metrics.find((metric) => metric.name.toLowerCase().includes(name))?.id;
  const points = (id?: string) => id ? entries.filter((entry) => entry.metricDefinitionId === id && entry.valueNumber != null).map((entry) => ({ date: entry.localDate, value: entry.valueNumber! })) : [];
  const tradeOff = detectTradeOff({ work: points(numeric("focus")), sleep: points(numeric("sleep")), relationships: [] });
  const insights = [...inputValue.filter((item) => item.value === "LOW_VALUE" || item.value === "UNCONNECTED").map((item) => ({ title: `${item.metric.name}: ${item.value.replace("_", " ")}`, explanation: item.message, confidence: item.logged >= 5 ? "MEDIUM" : "LOW" })), ...(tradeOff ? [tradeOff] : [])];
  return { areas, metrics: inputValue, habits, pathways, tasks, insights };
}

export async function getDeterministicWeeklyIntelligence(userId: string) {
  const architecture = await getArchitectureView(userId); const improved:string[]=[]; const deteriorated:string[]=[];
  for (const item of architecture.metrics) { const entries=await prisma.metricEntry.findMany({ where:{userId,metricDefinitionId:item.metric.id,valueNumber:{not:null}},orderBy:{localDate:"asc"},take:14 }); const signal=trend(entries.map((entry)=>({date:entry.localDate,value:entry.valueNumber!}))); if (!signal || signal.confidence === "INSUFFICIENT_DATA") continue; if (signal.direction === "UP") improved.push(item.metric.name); if (signal.direction === "DOWN") deteriorated.push(item.metric.name); }
  const neglected=architecture.areas.filter((area)=>!architecture.habits.some((habit)=>habit.lifeAreaId===area.id)).map((area)=>area.name); const recommendation=weeklyRecommendation({improved,deteriorated,neglected}); return { improved, deteriorated, neglected, recommendation, confidence: confidenceFor([]) };
}

function validateProposal(proposal: PathwayProposal, input: { baselineValue?: number; targetValue?: number; direction?: string; unit?: string }) {
  const numeric = proposal.milestones.filter((item) => item.targetValue != null).map((item) => item.targetValue!);
  const baseline = input.baselineValue; const target = input.targetValue; const decreasing = input.direction === "DECREASE";
  if (new Set(numeric).size !== numeric.length) throw new Error("The generated pathway had duplicate milestones. Please retry.");
  if (baseline != null && target != null && numeric.some((value) => decreasing ? value >= baseline || value <= target : value <= baseline || value >= target)) throw new Error("The generated milestones did not sit between your baseline and target. Please retry.");
  if (numeric.some((value, index) => index > 0 && (decreasing ? value >= numeric[index - 1] : value <= numeric[index - 1]))) throw new Error("The generated milestones were not ordered correctly. Please retry.");
  return proposal;
}

async function findOrCreateMetric(userId: string, metric: PathwayProposal["suggestedMetrics"][number]) {
  const key = metric.name.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "").slice(0, 48) || "pathway_metric";
  const existing = await prisma.metricDefinition.findFirst({ where: { userId, OR: [{ key }, { name: { equals: metric.name, mode: "insensitive" } }] } });
  if (existing) return existing;
  return prisma.metricDefinition.create({ data: { userId, key, name: metric.name, description: metric.rationale, valueType: "NUMBER", unit: metric.unit, category: "pathway", targetDirection: metric.direction, frequency: metric.frequency, showInCheckIn: metric.frequency === "DAILY", showInDashboard: true, important: true } });
}
