import { prisma } from "@/lib/db/prisma";

export async function getAlignmentCommand(userId: string, lifeAreaId: string) {
  const area = await prisma.lifeArea.findFirst({
    where: { id: lifeAreaId, userId },
    include: {
      objectives: { where: { active: true }, include: { keyResults: { where: { active: true } }, pathway: { include: { milestones: { orderBy: { sequence: "asc" } }, metrics: { where: { active: true }, include: { metricDefinition: true } }, actions: { where: { active: true }, orderBy: { priority: "asc" } }, trajectorySnapshots: { orderBy: { localDate: "desc" }, take: 1 }, proposals: { where: { status: "PENDING" }, orderBy: { generatedAt: "desc" } } } } }, orderBy: { priority: "asc" } },
      habits: { where: { active: true }, include: { objective: true }, orderBy: { name: "asc" } },
      tasks: { where: { active: true, showToday: true }, include: { objective: true }, orderBy: { priority: "asc" } },
      alignmentSessions: { where: { status: "ACTIVE" }, orderBy: { updatedAt: "desc" }, take: 1, include: { assertions: { where: { active: true }, orderBy: { createdAt: "asc" } } } }
    }
  });
  if (!area) return null;
  const pathways = area.objectives.flatMap((objective) => objective.pathway ? [{ objective, pathway: objective.pathway }] : []);
  const metricIds = pathways.flatMap(({ pathway }) => pathway.metrics.map((item) => item.metricDefinitionId));
  const latestEntries = metricIds.length ? await prisma.metricEntry.findMany({ where: { userId, metricDefinitionId: { in: metricIds } }, orderBy: { localDate: "desc" } }) : [];
  const seen = new Set<string>();
  const metrics = latestEntries.filter((entry) => !seen.has(entry.metricDefinitionId) && Boolean(seen.add(entry.metricDefinitionId)));
  return { area, pathways, metrics };
}

export function displayMetric(value: { valueNumber: number | null; valueText: string | null; valueBoolean: boolean | null }, unit?: string | null) {
  if (value.valueBoolean != null) return value.valueBoolean ? "Complete" : "Not complete";
  if (value.valueText) return value.valueText;
  return value.valueNumber != null ? `${value.valueNumber}${unit ? ` ${unit}` : ""}` : "No observation yet";
}
