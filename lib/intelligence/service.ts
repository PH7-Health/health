import { z } from "zod";
import { directedMovement } from "@/lib/life-os/experience";
import {
  IntelligenceConfidence,
  TrajectoryStatus,
  type Prisma,
} from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { weekStart, addDays, localDate } from "@/lib/life-os/date";
import {
  intelligenceProvider,
  IntelligenceProviderError,
  PATHWAY_SCHEMA_VERSION,
  pathwayProposalSchema,
  validatePathwaySemantics,
  type PathwayProposal,
  type ProviderInput,
} from "./provider";
import { estimateTrajectory, milestoneComplete } from "./trajectory";
import {
  classifyInput,
  confidenceFor,
  detectTradeOff,
  trend,
  weeklyRecommendation,
} from "./analysis";
import { selectPrimaryMetric } from "./metric-compatibility";

const confidence = (value: string) => value as IntelligenceConfidence;
const trajectory = (value: string) => value as TrajectoryStatus;

export async function createPathwayProposal(
  userId: string,
  input: {
    objectiveId: string;
    currentDescription: string;
    desiredDescription: string;
    constraints?: string;
    preferences?: string;
    baselineValue?: number;
    targetValue?: number;
    unit?: string;
    direction?: string;
    desiredDate?: string;
  },
) {
  const objective = await prisma.objective.findFirst({
    where: { id: input.objectiveId, userId },
  });
  if (!objective) throw new Error("Objective not found");
  const direction = input.direction ?? "INCREASE";
  const availableMetrics = await prisma.metricDefinition.findMany({
    where: { userId, active: true },
    select: {
      id: true,
      name: true,
      unit: true,
      valueType: true,
      frequency: true,
      category: true,
      targetDirection: true,
    },
  });
  const providerInput: ProviderInput = {
    current: input.currentDescription,
    desired: input.desiredDescription,
    baseline: input.baselineValue ?? null,
    target: input.targetValue ?? null,
    unit: input.unit ?? null,
    direction,
    constraints: input.constraints ?? null,
    metrics: availableMetrics,
  };
  let generated;
  try {
    generated = await intelligenceProvider.generatePathway(providerInput);
  } catch (error) {
    if (error instanceof IntelligenceProviderError) {
      await recordPathwayDiagnostic(userId, error);
      throw error;
    }
    throw new Error("Pathway generation failed safely. Please retry.");
  }
  const primaryMetric = selectPrimaryMetric(
    { desired: input.desiredDescription, unit: input.unit ?? null, direction },
    availableMetrics.map((metric) => ({
      ...metric,
      direction: metric.targetDirection,
    })),
    generated.proposal.suggestedMetrics,
  );
  const proposal = {
    ...generated.proposal,
    suggestedMetrics: [
      primaryMetric,
      ...generated.proposal.suggestedMetrics.filter(
        (metric) =>
          metric.existingMetricId !== primaryMetric.existingMetricId ||
          metric.name !== primaryMetric.name,
      ),
    ],
  };
  const result = validateProposal(proposal, providerInput);
  const config = pathwayConfiguration.parse({
    currentDescription: input.currentDescription,
    desiredDescription: input.desiredDescription,
    constraints: input.constraints || null,
    preferences: input.preferences || null,
    baselineValue: input.baselineValue ?? null,
    targetValue: input.targetValue ?? null,
    unit: input.unit || null,
    direction,
    desiredDate: input.desiredDate || null,
  });
  return prisma.$transaction(async (tx) => {
    // Generation may create a draft shell, but never edits an existing strategy.
    const pathway = await tx.goalPathway.upsert({
      where: { objectiveId: objective.id },
      update: {},
      create: {
        userId,
        objectiveId: objective.id,
        ...config,
        desiredDate: config.desiredDate ? new Date(config.desiredDate) : null,
      },
    });
    await tx.aIExecution.create({
      data: {
        userId,
        provider: generated.provider,
        model: generated.model,
        operation: "pathway_generation",
        schemaVersion: PATHWAY_SCHEMA_VERSION,
        inputWindow: { ...input, metrics: availableMetrics },
        output: result,
      },
    });
    return tx.aIProposal.create({
      data: {
        userId,
        pathwayId: pathway.id,
        type: "PATHWAY",
        title: `Proposed pathway: ${objective.title}`,
        rationale: result.rationale,
        payload: result,
        dataWindow: { proposalVersion: 1, config },
        provider: generated.provider,
        model: generated.model,
        schemaVersion: PATHWAY_SCHEMA_VERSION,
        confidence: result.confidence,
      },
    });
  });
}

const pathwayConfiguration = z
  .object({
    currentDescription: z.string().min(1),
    desiredDescription: z.string().min(1),
    constraints: z.string().nullable(),
    preferences: z.string().nullable(),
    baselineValue: z.number().finite().nullable(),
    targetValue: z.number().finite().nullable(),
    unit: z.string().nullable(),
    direction: z.enum(["INCREASE", "DECREASE"]),
    desiredDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .nullable(),
  })
  .strict();

export async function resolveProposal(
  userId: string,
  proposalId: string,
  accept: boolean,
) {
  return prisma.$transaction(async (tx) => {
    const proposal = await tx.aIProposal.findFirst({
      where: { id: proposalId, userId, status: "PENDING" },
      include: {
        pathway: {
          include: { milestones: true, actions: true, metrics: true },
        },
      },
    });
    if (!proposal?.pathway) return;
    const claimed = await tx.aIProposal.updateMany({
      where: { id: proposal.id, userId, status: "PENDING" },
      data: {
        status: accept ? "ACCEPTED" : "DISMISSED",
        resolvedAt: new Date(),
      },
    });
    if (!claimed.count || !accept) return;
    const payload = validateProposalPayload(proposal.payload);
    const staged = proposal.dataWindow as {
      proposalVersion?: number;
      config?: unknown;
    } | null;
    if (staged?.proposalVersion === 1) {
      const config = pathwayConfiguration.parse(staged.config);
      await tx.pathwayRevision.create({
        data: {
          pathwayId: proposal.pathway.id,
          reason: "Explicit approval of " + proposal.id,
          snapshot: JSON.parse(JSON.stringify(proposal.pathway)),
        },
      });
      await tx.goalPathway.update({
        where: { id: proposal.pathway.id },
        data: {
          ...config,
          desiredDate: config.desiredDate ? new Date(config.desiredDate) : null,
        },
      });
      // Retain old checkpoints and actions for history instead of deleting them.
      const offset = Math.max(
        0,
        ...proposal.pathway.milestones.map((m) => m.sequence),
      );
      await tx.milestone.updateMany({
        where: {
          pathwayId: proposal.pathway.id,
          status: { in: ["ACTIVE", "PENDING"] },
        },
        data: { status: "SKIPPED" },
      });
      await tx.milestone.createMany({
        data: payload.milestones.map((m, index) => ({
          pathwayId: proposal.pathway!.id,
          sequence: offset + index + 1,
          title: m.title,
          description: m.rationale,
          targetValue: m.targetValue,
          unit: config.unit,
          status: index === 0 ? ("ACTIVE" as const) : ("PENDING" as const),
        })),
      });
      await tx.pathwayAction.updateMany({
        where: { pathwayId: proposal.pathway.id, active: true },
        data: { active: false },
      });
      await tx.pathwayAction.createMany({
        data: payload.pathwayActions.map((a, index) => ({
          pathwayId: proposal.pathway!.id,
          title: a.title,
          rationale: a.rationale,
          expectedImpact: a.expectedImpact,
          priority: index + 1,
        })),
      });
    }
    const metric = payload.suggestedMetrics[0];
    if (metric) {
      const definition = metric.existingMetricId
        ? await tx.metricDefinition.findFirst({
            where: { id: metric.existingMetricId, userId },
          })
        : await findOrCreateMetric(userId, metric, tx);
      if (!definition)
        throw new Error(
          "The proposed metric is no longer available. Review the proposal again.",
        );
      await tx.pathwayMetric.updateMany({
        where: {
          pathwayId: proposal.pathway.id,
          role: "PRIMARY",
          active: true,
        },
        data: { active: false },
      });
      await tx.pathwayMetric.upsert({
        where: {
          pathwayId_metricDefinitionId: {
            pathwayId: proposal.pathway.id,
            metricDefinitionId: definition.id,
          },
        },
        update: { rationale: metric.rationale, active: true, role: "PRIMARY" },
        create: {
          pathwayId: proposal.pathway.id,
          metricDefinitionId: definition.id,
          rationale: metric.rationale,
          role: "PRIMARY",
        },
      });
    }
    await tx.goalPathway.update({
      where: { id: proposal.pathway.id },
      data: {
        status: "ACTIVE",
        limiterTitle: payload.likelyLimiter.title,
        limiterExplanation: payload.likelyLimiter.explanation,
        limiterConfidence: payload.likelyLimiter.confidence,
      },
    });
  });
}
function validateProposalPayload(payload: Prisma.JsonValue) {
  return pathwayProposalSchema.parse(payload);
}

export async function recalculatePathway(userId: string, pathwayId: string) {
  const pathway = await prisma.goalPathway.findFirst({
    where: { id: pathwayId, userId },
    include: { objective: true, milestones: { orderBy: { sequence: "asc" } } },
  });
  if (!pathway || pathway.baselineValue == null || pathway.targetValue == null)
    return null;
  const bound = await prisma.pathwayMetric.findFirst({
    where: { pathwayId, active: true },
    include: { metricDefinition: true },
  });
  const metric = bound?.metricDefinition;
  const entries = metric
    ? await prisma.metricEntry.findMany({
        where: {
          userId,
          metricDefinitionId: metric.id,
          valueNumber: { not: null },
        },
        orderBy: { localDate: "asc" },
        take: 60,
      })
    : [];
  const current = entries.at(-1)?.valueNumber ?? pathway.baselineValue;
  const estimate = estimateTrajectory({
    baseline: pathway.baselineValue,
    target: pathway.targetValue,
    current,
    points: entries.map((entry) => ({
      date: entry.localDate,
      value: entry.valueNumber!,
    })),
    desiredDate: pathway.desiredDate,
  });
  const active = pathway.milestones.find(
    (milestone) => milestone.status === "ACTIVE",
  );
  if (
    active?.targetValue != null &&
    milestoneComplete(pathway.direction, current, active.targetValue)
  ) {
    await prisma.milestone.update({
      where: { id: active.id },
      data: { status: "COMPLETED", completedAt: new Date() },
    });
    const next = pathway.milestones.find(
      (milestone) => milestone.sequence === active.sequence + 1,
    );
    if (next)
      await prisma.milestone.update({
        where: { id: next.id },
        data: { status: "ACTIVE" },
      });
  }
  await prisma.goalPathway.update({
    where: { id: pathway.id },
    data: {
      trajectoryStatus: trajectory(estimate.status),
      confidence: confidence(estimate.confidence),
      lastRecalculatedAt: new Date(),
    },
  });
  await prisma.trajectorySnapshot.upsert({
    where: { pathwayId_localDate: { pathwayId, localDate: localDate() } },
    update: {
      progressPercent: estimate.progress,
      velocity: estimate.velocity,
      estimateLowDate: estimate.low,
      estimateHighDate: estimate.high,
      status: trajectory(estimate.status),
      confidence: confidence(estimate.confidence),
      basis: estimate.basis,
      snapshot: estimate,
    },
    create: {
      userId,
      pathwayId,
      localDate: localDate(),
      progressPercent: estimate.progress,
      velocity: estimate.velocity,
      estimateLowDate: estimate.low,
      estimateHighDate: estimate.high,
      status: trajectory(estimate.status),
      confidence: confidence(estimate.confidence),
      basis: estimate.basis,
      snapshot: estimate,
    },
  });
  await refreshPathwayIntelligence(userId, pathwayId, estimate, current);
  return estimate;
}

async function refreshPathwayIntelligence(
  userId: string,
  pathwayId: string,
  estimate: ReturnType<typeof estimateTrajectory>,
  current: number,
) {
  const pathway = await prisma.goalPathway.findUniqueOrThrow({
    where: { id: pathwayId },
    include: { objective: true, milestones: { orderBy: { sequence: "asc" } } },
  });
  const next = pathway.milestones.find((item) => item.status === "ACTIVE");
  const title =
    estimate.status === "INSUFFICIENT_DATA"
      ? "More evidence is needed"
      : estimate.status === "STALLED"
        ? "Progress has stalled"
        : "Continue the current pathway";
  const explanation =
    estimate.status === "INSUFFICIENT_DATA"
      ? estimate.basis
      : estimate.status === "STALLED"
        ? `${estimate.basis} The current limiter is insufficient measurable movement, not a confirmed cause.`
        : `${estimate.basis} Current value: ${current}${pathway.unit ? ` ${pathway.unit}` : ""}.`;
  await prisma.insight.upsert({
    where: {
      userId_fingerprint: {
        userId,
        fingerprint: `trajectory:${pathwayId}:${estimate.status}`,
      },
    },
    update: {
      title,
      explanation,
      evidence: estimate,
      confidence: confidence(estimate.confidence),
    },
    create: {
      userId,
      pathwayId,
      type:
        estimate.status === "STALLED"
          ? "STALL"
          : estimate.status === "INSUFFICIENT_DATA"
            ? "DATA_QUALITY"
            : "PROGRESS",
      fingerprint: `trajectory:${pathwayId}:${estimate.status}`,
      title,
      explanation,
      evidence: estimate,
      confidence: confidence(estimate.confidence),
    },
  });
  await prisma.recommendation.upsert({
    where: {
      userId_fingerprint: { userId, fingerprint: `pathway:${pathwayId}:next` },
    },
    update: {
      title:
        estimate.status === "ON_TRACK"
          ? "Nothing to change"
          : next
            ? `Protect: ${next.title}`
            : "Review the next milestone",
      explanation:
        estimate.status === "ON_TRACK"
          ? "Available evidence remains consistent with the current pathway. Continue the strategy."
          : next
            ? `The next milestone is ${next.title}. Focus on the smallest linked action.`
            : explanation,
      confidence: confidence(estimate.confidence),
    },
    create: {
      userId,
      pathwayId,
      fingerprint: `pathway:${pathwayId}:next`,
      title:
        estimate.status === "ON_TRACK"
          ? "Nothing to change"
          : next
            ? `Protect: ${next.title}`
            : "Review the next milestone",
      explanation:
        estimate.status === "ON_TRACK"
          ? "Available evidence remains consistent with the current pathway. Continue the strategy."
          : next
            ? `The next milestone is ${next.title}. Focus on the smallest linked action.`
            : explanation,
      confidence: confidence(estimate.confidence),
    },
  });
}

export async function getIntelligenceView(userId: string) {
  const [pathways, proposals, insights, recommendations] = await Promise.all([
    prisma.goalPathway.findMany({
      where: { userId },
      include: {
        objective: { include: { lifeArea: true } },
        milestones: { orderBy: { sequence: "asc" } },
        metrics: {
          where: { active: true },
          include: { metricDefinition: true },
        },
        actions: { where: { active: true }, orderBy: { priority: "asc" } },
        trajectorySnapshots: { orderBy: { localDate: "desc" }, take: 1 },
      },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.aIProposal.findMany({
      where: { userId, status: "PENDING" },
      include: { pathway: true },
      orderBy: { generatedAt: "desc" },
    }),
    prisma.insight.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 8,
    }),
    prisma.recommendation.findMany({
      where: { userId, active: true },
      orderBy: { updatedAt: "desc" },
      take: 6,
    }),
  ]);
  return { pathways, proposals, insights, recommendations };
}

export async function getArchitectureView(userId: string) {
  const [areas, metrics, entries, habits, pathways, tasks] = await Promise.all([
    prisma.lifeArea.findMany({
      where: { userId, active: true },
      include: { objectives: { where: { active: true } } },
      orderBy: { sortOrder: "asc" },
    }),
    prisma.metricDefinition.findMany({
      where: { userId, active: true },
      orderBy: { name: "asc" },
    }),
    prisma.metricEntry.findMany({
      where: {
        userId,
        localDate: { gte: new Date(Date.now() - 30 * 86_400_000) },
      },
    }),
    prisma.habit.findMany({
      where: { userId, active: true },
      include: { objective: true },
    }),
    prisma.goalPathway.findMany({
      where: { userId },
      include: { metrics: true, milestones: { orderBy: { sequence: "asc" } } },
    }),
    prisma.task.findMany({
      where: { userId, active: true, objectiveId: { not: null } },
    }),
  ]);
  const inputValue = metrics.map((metric) => {
    const linked = pathways.some(
      (pathway) =>
        pathway.status === "ACTIVE" &&
        pathway.metrics.some(
          (binding) =>
            binding.metricDefinitionId === metric.id && binding.active,
        ),
    );
    const logged = entries.filter(
      (entry) => entry.metricDefinitionId === metric.id,
    ).length;
    const value = classifyInput({
      pathwayLinked: linked,
      scoreRelevant: metric.useInScore,
      driftRelevant: metric.useInDrift,
      loggedCount: logged,
      frequency: metric.frequency,
    });
    return {
      metric,
      value,
      logged,
      linked,
      message:
        value === "LOW_VALUE"
          ? "Logged daily but it currently influences no active pathway, score, or drift rule."
          : value === "UNCONNECTED"
            ? "Not connected to an active pathway or current calculation."
            : value === "REQUIRED"
              ? "Directly measures an active pathway."
              : "Supports an existing score or drift calculation.",
    };
  });
  const numeric = (name: string) =>
    metrics.find((metric) => metric.name.toLowerCase().includes(name))?.id;
  const points = (id?: string) =>
    id
      ? entries
          .filter(
            (entry) =>
              entry.metricDefinitionId === id && entry.valueNumber != null,
          )
          .map((entry) => ({
            date: entry.localDate,
            value: entry.valueNumber!,
          }))
      : [];
  const tradeOff = detectTradeOff({
    work: points(numeric("focus")),
    sleep: points(numeric("sleep")),
    relationships: [],
  });
  const insights = [
    ...inputValue
      .filter(
        (item) => item.value === "LOW_VALUE" || item.value === "UNCONNECTED",
      )
      .map((item) => ({
        title: `${item.metric.name}: ${item.value.replace("_", " ")}`,
        explanation: item.message,
        confidence: item.logged >= 5 ? "MEDIUM" : "LOW",
      })),
    ...(tradeOff ? [tradeOff] : []),
  ];
  return { areas, metrics: inputValue, habits, pathways, tasks, insights };
}

export async function getDeterministicWeeklyIntelligence(userId: string) {
  const architecture = await getArchitectureView(userId);
  const improved: string[] = [];
  const deteriorated: string[] = [];
  const start = weekStart();
  const end = addDays(start, 7);
  const samples: Array<{ date: Date; value: number }> = [];
  for (const item of architecture.metrics) {
    const entries = await prisma.metricEntry.findMany({
      where: {
        userId,
        metricDefinitionId: item.metric.id,
        valueNumber: { not: null },
        localDate: { gte: start, lt: end },
      },
      orderBy: { localDate: "asc" },
    });
    const signal = trend(
      entries.map((entry) => ({
        date: entry.localDate,
        value: entry.valueNumber!,
      })),
    );
    if (!signal || signal.confidence === "INSUFFICIENT_DATA") continue;
    samples.push(
      ...entries.map((entry) => ({
        date: entry.localDate,
        value: entry.valueNumber!,
      })),
    );
    const movement = directedMovement(
      signal.delta,
      item.metric.targetDirection,
    );
    if (movement === "improved") improved.push(item.metric.name);
    if (movement === "deteriorated") deteriorated.push(item.metric.name);
  }
  const neglected: string[] = []; // No configured habit is not evidence of real-world neglect.
  const recommendation = weeklyRecommendation({
    improved,
    deteriorated,
    neglected,
  });
  return {
    improved,
    deteriorated,
    neglected,
    recommendation,
    confidence: confidenceFor(
      samples.sort((a, b) => a.date.getTime() - b.date.getTime()),
    ),
  };
}

function validateProposal(proposal: PathwayProposal, input: ProviderInput) {
  const issues = validatePathwaySemantics(proposal, input);
  if (issues.length)
    throw new Error(
      `The generated pathway did not pass deterministic validation at ${issues[0].path}. Please retry.`,
    );
  return proposal;
}

async function recordPathwayDiagnostic(
  userId: string,
  error: IntelligenceProviderError,
) {
  if (!error.diagnostic) return;
  // Persist only contract metadata, never the user narrative or raw model output.
  await prisma.aIExecution.create({
    data: {
      userId,
      provider: error.diagnostic.provider,
      model: error.diagnostic.model,
      operation: "pathway_generation_validation",
      schemaVersion: error.diagnostic.schemaVersion,
      inputWindow: { inputCaptured: false },
      output: error.diagnostic,
    },
  });
}

async function findOrCreateMetric(
  userId: string,
  metric: PathwayProposal["suggestedMetrics"][number],
  db: Prisma.TransactionClient = prisma,
) {
  const key =
    metric.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_|_$/g, "")
      .slice(0, 48) || "pathway_metric";
  const existing = await db.metricDefinition.findFirst({
    where: {
      userId,
      OR: [{ key }, { name: { equals: metric.name, mode: "insensitive" } }],
    },
  });
  if (existing) return existing;
  return db.metricDefinition.create({
    data: {
      userId,
      key,
      name: metric.name,
      description: metric.rationale,
      valueType: "NUMBER",
      unit: metric.unit,
      category: "pathway",
      targetDirection: metric.direction,
      frequency: metric.frequency,
      showInCheckIn: metric.frequency === "DAILY",
      showInDashboard: true,
      important: true,
    },
  });
}
