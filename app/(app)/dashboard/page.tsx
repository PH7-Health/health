import Link from "next/link";
import { requireUser } from "@/lib/auth/session";
import { getDashboardView } from "@/lib/life-os/service";
import { getIntelligenceView } from "@/lib/intelligence/service";
import { ProgressChart } from "@/components/progress-chart";
import { trajectoryLabel, metricValue } from "@/lib/life-os/experience";
import { prisma } from "@/lib/db/prisma";
export default async function DashboardPage() {
  const user = await requireUser();
  const [state, intelligence, metrics] = await Promise.all([
    getDashboardView(user.id),
    getIntelligenceView(user.id),
    prisma.metricDefinition.findMany({
      where: { userId: user.id, active: true, showInDashboard: true },
      include: { entries: { orderBy: { localDate: "desc" }, take: 8 } },
      orderBy: { name: "asc" },
    }),
  ]);
  const active = intelligence.pathways.filter((p) => p.status === "ACTIVE");
  const concerns = active.filter((p) =>
    ["BEHIND", "STALLED", "WATCH"].includes(p.trajectoryStatus),
  );
  return (
    <div className="page progress-page">
      <section className="section-intro">
        <div>
          <p className="eyebrow">Direction over time</p>
          <h2>
            {concerns.length
              ? "A strategy deserves a closer look."
              : active.length
                ? "Are you getting closer?"
                : "Start with a direction."}
          </h2>
          <p>
            {active.length
              ? "Assess the outcome separately from how many actions you complete."
              : "Choose an outcome in Alignment so observations have something useful to inform."}
          </p>
        </div>
        <Link className="button quiet" href="/weekly-review">
          Review the week →
        </Link>
      </section>
      <section className="progress-pathways">
        {active.map((p) => {
          const snap = p.trajectorySnapshots[0];
          const binding = p.metrics.find((m) => m.role === "PRIMARY");
          const m = metrics.find((m) => m.id === binding?.metricDefinitionId);
          return (
            <article key={p.id}>
              <div className="section-heading">
                <div>
                  <p className="eyebrow">{p.objective.lifeArea.name}</p>
                  <h3>{p.desiredDescription}</h3>
                </div>
                <span className="status-text">
                  {trajectoryLabel(snap?.status ?? p.trajectoryStatus)}
                </span>
              </div>
              <p>
                {snap?.basis ??
                  "Not enough observations to assess this direction yet."}
              </p>
              <div className="then-now-next">
                <div>
                  <small>Starting point</small>
                  <strong>{p.currentDescription}</strong>
                </div>
                <div>
                  <small>Latest measured</small>
                  <strong>
                    {metricValue(m?.entries[0], binding?.metricDefinition.unit)}
                  </strong>
                </div>
                <div>
                  <small>Next checkpoint</small>
                  <strong>
                    {p.milestones.find((m) => m.status === "ACTIVE")?.title ??
                      "To define"}
                  </strong>
                </div>
              </div>
              <Link href={`/alignment/${p.objective.lifeAreaId}`}>
                Understand the strategy →
              </Link>
            </article>
          );
        })}
        {!active.length && (
          <Link href="/alignment">Define what you want to move toward →</Link>
        )}
      </section>
      <ProgressChart
        title="Your daily rhythm · last 30 days"
        points={state.thirty.map((p) => ({
          date: p.localDate.toISOString().slice(0, 10),
          score: p.score,
        }))}
      />
      <details className="quiet-details">
        <summary>Measurements · {metrics.length} tracked</summary>
        <div className="measurement-list">
          {metrics.map((m) => (
            <details key={m.id}>
              <summary>
                <strong>{m.name}</strong>
                <span>{metricValue(m.entries[0], m.unit)}</span>
              </summary>
              <p>
                {m.description ?? "A measurement you have chosen to track."}
              </p>
              {m.entries.map((e) => (
                <p key={e.id}>
                  {e.localDate.toISOString().slice(0, 10)} ·{" "}
                  {metricValue(e, m.unit)}
                </p>
              ))}
              {!m.entries.length && <p>No values recorded yet.</p>}
              <Link href="/check-in">Record an observation →</Link>
            </details>
          ))}
        </div>
      </details>
      {state.alerts.length > 0 && (
        <section className="attention-strip">
          <p className="eyebrow">Needs attention</p>
          {state.alerts.map((a) => (
            <details key={a.id}>
              <summary>{a.title}</summary>
              <p>{a.explanation}</p>
              <p>{a.recommendedAction}</p>
            </details>
          ))}
        </section>
      )}
    </div>
  );
}
