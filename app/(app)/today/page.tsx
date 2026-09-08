import Link from "next/link";
import { requireUser } from "@/lib/auth/session";
import { localDate, dateLabel } from "@/lib/life-os/date";
import { getTodayView } from "@/lib/life-os/service";
import { TodayControl, type TodayItem } from "@/components/today-control";
import { getIntelligenceView } from "@/lib/intelligence/service";
import { actionConnection } from "@/lib/life-os/experience";
import { AskLifeOs } from "@/components/ask-life-os";
export default async function TodayPage({
  searchParams,
}: {
  searchParams: Promise<{ checkedIn?: string; date?: string }>;
}) {
  const user = await requireUser();
  const params = await searchParams;
  const parsed =
    params.date && /^\d{4}-\d{2}-\d{2}$/.test(params.date)
      ? new Date(`${params.date}T00:00:00.000Z`)
      : undefined;
  const requested =
    parsed && Number.isFinite(parsed.getTime()) && parsed <= localDate()
      ? parsed
      : undefined;
  const [state, intelligence] = await Promise.all([
    getTodayView(user.id, requested),
    getIntelligenceView(user.id),
  ]);
  const connection = (item: {
    id: string;
    objectiveId: string | null;
    lifeAreaId: string | null;
  }) =>
    actionConnection(
      item,
      intelligence.pathways,
      state.objectives,
      state.areas,
    );
  const items: TodayItem[] = [
    ...state.tasks.map((x) => ({
      id: x.id,
      title: x.title,
      meta: x.lifeArea?.name ?? "Work",
      type: "task" as const,
      done: state.taskCompletions.some(
        (i) => i.taskId === x.id && i.state === "COMPLETED",
      ),
      rank:
        x.priority === "MOST_IMPORTANT" ? 0 : x.priority === "CRITICAL" ? 1 : 5,
      connection: connection(x),
    })),
    ...state.habits.map((x) => ({
      id: x.id,
      title: x.name,
      meta: x.lifeArea.name,
      type: "habit" as const,
      done: state.habitCompletions.some(
        (i) => i.habitId === x.id && i.state === "COMPLETED",
      ),
      rank: x.objectiveId ? 2 : 6,
      connection: connection(x),
    })),
    ...state.supplements.map((x) => ({
      id: x.id,
      title: x.name,
      meta: `${x.intendedDose ?? ""} ${x.doseUnit ?? ""} · ${x.normalTime ?? "Protocol"}`,
      type: "supplement" as const,
      done: state.supplementLogs.some(
        (i) => i.supplementId === x.id && i.state === "COMPLETED",
      ),
      rank: 9,
      connection: connection({
        id: x.id,
        objectiveId: null,
        lifeAreaId: state.areas.find((a) => a.key === "health")?.id ?? null,
      }),
    })),
  ];
  const parts = state.parts.map((p) => ({
    ...p,
    details:
      p.details && typeof p.details === "object" && "ratio" in p.details
        ? (p.details as {
            ratio: number;
            target: string;
            actual: string;
            reason: string;
          })
        : null,
  }));
  const prev = new Date(state.date);
  prev.setUTCDate(prev.getUTCDate() - 1);
  const next = new Date(state.date);
  next.setUTCDate(next.getUTCDate() + 1);
  const href = (d: Date) => `/today?date=${d.toISOString().slice(0, 10)}`;
  return (
    <div className="page today-page">
      <div className="date-rail">
        <Link href={href(prev)} aria-label="Previous day">
          ← Previous
        </Link>
        <span>
          {dateLabel(state.date)}
          {!state.isToday ? " · Read only" : ""}
        </span>
        {state.isToday ? (
          <Link href="/dashboard">Progress →</Link>
        ) : (
          <Link href={href(next)} aria-label="Next day">
            Next →
          </Link>
        )}
      </div>
      {params.checkedIn && (
        <p className="success-note" role="status">
          Check-in saved. Today reflects your recorded values.
        </p>
      )}
      {state.alerts.length > 0 && (
        <section className="attention-strip">
          <p className="eyebrow">Needs attention</p>
          {state.alerts.slice(0, 2).map((a) => (
            <details key={a.id}>
              <summary>{a.title}</summary>
              <p>{a.explanation}</p>
              <p>{a.recommendedAction}</p>
            </details>
          ))}
        </section>
      )}
      {state.isToday ? (
        <TodayControl
          score={state.score}
          status={state.status}
          parts={parts}
          items={items}
        />
      ) : (
        <section className="history-view">
          <p className="eyebrow">Recorded day</p>
          <h2>
            {state.hasScore ? `${state.score} / 100` : "No score recorded"}
          </h2>
          <p>{state.summary}</p>
          <details open>
            <summary>Recorded actions, habits and supplements</summary>
            {state.taskCompletions.map((i) => (
              <p key={i.id}>
                {i.task.title}: {i.state.toLowerCase()}
              </p>
            ))}
            {state.habitCompletions.map((i) => (
              <p key={i.id}>
                {i.habit.name}: {i.state.toLowerCase()}
              </p>
            ))}
            {state.supplementLogs.map((i) => (
              <p key={i.id}>
                {i.supplement.name}: {i.state.toLowerCase()}
              </p>
            ))}
            {!state.taskCompletions.length &&
              !state.habitCompletions.length &&
              !state.supplementLogs.length && (
                <p>No individual completion records for this day.</p>
              )}
            <p className="muted">
              Only recorded state is shown. Today's schedule is not projected
              into the past.
            </p>
            {state.parts.map((p) => (
              <p key={p.label}>
                {p.label}: {p.completed} of {p.expected} recorded in this score
                snapshot.
              </p>
            ))}
          </details>
          <details>
            <summary>Check-in and metrics</summary>
            {state.entries.map((e) => (
              <p key={e.id}>
                {e.metricDefinition.name}:{" "}
                {e.valueNumber ??
                  e.valueText ??
                  (e.valueBoolean == null
                    ? "Not recorded"
                    : e.valueBoolean
                      ? "Yes"
                      : "No")}
              </p>
            ))}
          </details>
          <Link href="/today">Return to Today →</Link>
        </section>
      )}
      <details className="quiet-details">
        <summary>How this fits your current strategy</summary>
        {intelligence.pathways
          .filter((p) => p.status === "ACTIVE")
          .map((p) => (
            <section key={p.id}>
              <h3>
                {p.objective.lifeArea.name}: {p.desiredDescription}
              </h3>
              <p>
                Current phase:{" "}
                {p.actions[0]?.title ?? "Review the next practical step."}
              </p>
              <Link href={`/alignment/${p.objective.lifeAreaId}`}>
                Review strategy →
              </Link>
            </section>
          ))}
        <AskLifeOs
          prompts={[
            "What is holding me back?",
            "What can I leave for another day?",
          ]}
        />
      </details>
    </div>
  );
}
