// Derived presentation only: these functions do not change scores or strategy.
export type ConnectionPathway = {
  id: string;
  status: string;
  objectiveId: string;
  desiredDescription: string;
  objective: {
    id: string;
    title: string;
    lifeArea: { id: string; name: string };
  };
  metrics: Array<{ role: string; metricDefinition: { name: string } }>;
  milestones: Array<{ title: string; status: string }>;
  actions: Array<{ taskId: string | null; rationale: string }>;
};
export type ActionConnection = {
  area: string;
  areaId: string;
  objective: string | null;
  desired: string | null;
  milestone: string | null;
  measures: string[];
  why: string;
  pathwayId?: string;
};
export function actionConnection(
  action: { id: string; objectiveId: string | null; lifeAreaId: string | null },
  pathways: ConnectionPathway[],
  objectives: Array<{ id: string; title: string; lifeAreaId: string }>,
  areas: Array<{ id: string; name: string }>,
): ActionConnection {
  const pathway =
    pathways.find(
      (p) =>
        p.status === "ACTIVE" && p.actions.some((a) => a.taskId === action.id),
    ) ??
    pathways.find(
      (p) => p.status === "ACTIVE" && p.objectiveId === action.objectiveId,
    );
  const objective = objectives.find((o) => o.id === action.objectiveId);
  const area = areas.find(
    (a) => a.id === (objective?.lifeAreaId ?? action.lifeAreaId),
  );
  const linked = pathway?.actions.find((a) => a.taskId === action.id);
  return {
    area: pathway?.objective.lifeArea.name ?? area?.name ?? "Unassigned",
    areaId: pathway?.objective.lifeArea.id ?? area?.id ?? "",
    objective: pathway?.objective.title ?? objective?.title ?? null,
    desired: pathway?.desiredDescription ?? null,
    milestone:
      pathway?.milestones.find((m) => m.status === "ACTIVE")?.title ?? null,
    measures:
      pathway?.metrics
        .filter((m) => m.role === "PRIMARY")
        .map((m) => m.metricDefinition.name) ?? [],
    why:
      linked?.rationale ??
      (objective
        ? `You linked this action to ${objective.title}.`
        : "Scheduled today. No active outcome is linked yet."),
    pathwayId: pathway?.id,
  };
}
export function metricValue(
  entry:
    | {
        valueNumber: number | null;
        valueText: string | null;
        valueBoolean: boolean | null;
      }
    | undefined,
  unit?: string | null,
) {
  if (!entry) return "Not recorded";
  if (entry.valueBoolean != null) return entry.valueBoolean ? "Yes" : "No";
  if (entry.valueText != null) return entry.valueText;
  return entry.valueNumber == null
    ? "Not recorded"
    : `${Number(entry.valueNumber.toFixed(2))}${unit ? ` ${unit}` : ""}`;
}
export function trajectoryLabel(status?: string) {
  return (
    (
      {
        ON_TRACK: "On track",
        AHEAD: "Ahead of plan",
        WATCH: "Worth a review",
        BEHIND: "Moving away from plan",
        STALLED: "Progress has slowed",
        INSUFFICIENT_DATA: "More observations needed",
      } as Record<string, string>
    )[status ?? ""] ?? "Not assessed yet"
  );
}
export function recordedCount(values: Record<string, string>) {
  return Object.values(values).filter((v) => v.trim() !== "").length;
}
export function inputStep(precision: number, valueType: string) {
  return valueType === "INTEGER"
    ? 1
    : Math.pow(10, -Math.max(0, Math.min(4, precision)));
}
export function directedMovement(
  delta: number,
  direction: string,
): "improved" | "deteriorated" | null {
  if (!delta || !["INCREASE", "DECREASE"].includes(direction)) return null;
  return delta > 0 === (direction === "INCREASE") ? "improved" : "deteriorated";
}
