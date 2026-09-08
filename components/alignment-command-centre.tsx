"use client";
import Link from "next/link";
import { useState } from "react";
import { AskLifeOs } from "./ask-life-os";
import { metricValue, trajectoryLabel } from "@/lib/life-os/experience";
import { DetailSheet } from "./detail-sheet";
type Command = NonNullable<
  Awaited<
    ReturnType<
      typeof import("@/lib/intelligence/alignment-command").getAlignmentCommand
    >
  >
>;
export function AlignmentCommandCentre({
  command,
  onRefine,
}: {
  command: Command;
  onRefine?: () => void;
}) {
  const { area, metrics } = command;
  const active = command.pathways.filter((p) => p.pathway.status === "ACTIVE");
  const [chosen, setChosen] = useState(active[0]?.pathway.id);
  const [focus, setFocus] = useState<string | null>(null);
  const primary = active.find((p) => p.pathway.id === chosen) ?? active[0];
  const pathway = primary?.pathway;
  const objective = primary?.objective;
  const next = pathway?.milestones.find((m) => m.status === "ACTIVE");
  const snapshot = pathway?.trajectorySnapshots[0];
  const bindings = pathway?.metrics ?? [];
  const primaryBinding = bindings.find((b) => b.role === "PRIMARY");
  const entry = metrics.find(
    (e) => e.metricDefinitionId === primaryBinding?.metricDefinitionId,
  );
  const behaviour = area.habits.filter((h) => h.objectiveId === objective?.id);
  const tasks = area.tasks.filter((t) => t.objectiveId === objective?.id);
  const status = snapshot?.status ?? pathway?.trajectoryStatus;
  const stages = [
    {
      id: "outcome",
      label: "Where you want to go",
      title: pathway?.desiredDescription ?? "Define your outcome",
    },
    {
      id: "strategy",
      label: "Current approach",
      title: pathway?.actions[0]?.title ?? "Shape the strategy",
    },
    {
      id: "milestones",
      label: "Next checkpoint",
      title: next?.title ?? "Choose a checkpoint",
    },
    {
      id: "measures",
      label: "How you will know",
      title: primaryBinding?.metricDefinition.name ?? "Choose a useful measure",
    },
    {
      id: "actions",
      label: "What you can do",
      title: behaviour[0]?.name ?? tasks[0]?.title ?? "Connect an action",
    },
  ];
  return (
    <section className="area-strategy">
      <div className="area-heading">
        <div>
          <p className="eyebrow">
            {pathway ? "Active strategy" : "Direction to explore"}
          </p>
          <h2>{area.name}</h2>
        </div>
        <button className="quiet" onClick={onRefine}>
          Something changed? Refine →
        </button>
      </div>
      {active.length > 1 && (
        <label className="objective-picker">
          Current objective
          <select value={chosen} onChange={(e) => setChosen(e.target.value)}>
            {active.map((p) => (
              <option key={p.pathway.id} value={p.pathway.id}>
                {p.objective.title}
              </option>
            ))}
          </select>
        </label>
      )}
      {pathway ? (
        <>
          <div className="area-state">
            <div>
              <small>{entry ? "Latest observation" : "Starting point"}</small>
              <strong>
                {entry
                  ? metricValue(entry, primaryBinding?.metricDefinition.unit)
                  : pathway.currentDescription}
              </strong>
              <span>
                {entry
                  ? entry.localDate.toISOString().slice(0, 10)
                  : "Stated baseline; no later measurement"}
              </span>
            </div>
            <i aria-hidden="true">→</i>
            <div>
              <small>Desired outcome</small>
              <strong>{pathway.desiredDescription}</strong>
              <span>{objective?.title}</span>
            </div>
          </div>
          <div className="trajectory-reading">
            <div>
              <span className={`status-marker ${status?.toLowerCase()}`} />
              <strong>{trajectoryLabel(status)}</strong>
            </div>
            <p>
              {snapshot?.basis ??
                "There are not enough observations to assess progress yet."}
            </p>
            <div className="trajectory-next">
              <small>Next checkpoint</small>
              <strong>{next?.title ?? "Define the next checkpoint"}</strong>
              <button
                className="text-button"
                onClick={() => setFocus("milestones")}
              >
                See progression →
              </button>
            </div>
          </div>
          <section className="strategy-focus">
            <p className="eyebrow">What matters now</p>
            <h3>
              {pathway.actions[0]?.title ??
                "Turn the strategy into one practical action."}
            </h3>
            <p>
              {pathway.actions[0]?.rationale ??
                "Your outcome is defined. Choose a repeatable way to make progress."}
            </p>
            {pathway.constraints && (
              <details>
                <summary>Constraints this must respect</summary>
                <p>{pathway.constraints}</p>
              </details>
            )}
            <div className="inline-actions">
              <Link className="button" href="/today">
                Put it into practice →
              </Link>
              <AskLifeOs
                pathwayId={pathway.id}
                lifeAreaId={area.id}
                prompts={[
                  "What is currently holding me back?",
                  "What should stay the same this week?",
                ]}
              />
            </div>
          </section>
          <section className="meaning-spine" aria-label="Strategic spine">
            <p className="eyebrow">The path, explained</p>
            {stages.map((s, i) => (
              <button
                key={s.id}
                onClick={() => setFocus(s.id)}
                className={focus === s.id ? "selected" : ""}
              >
                <span>{String(i + 1).padStart(2, "0")}</span>
                <div>
                  <small>{s.label}</small>
                  <strong>{s.title}</strong>
                </div>
                <i>→</i>
              </button>
            ))}
          </section>
          {(!bindings.length || (!behaviour.length && !tasks.length)) && (
            <section className="connection-gap">
              <h3>
                {!bindings.length
                  ? "How will you know it is working?"
                  : "What will you consistently do?"}
              </h3>
              <p>
                {!bindings.length
                  ? "Your direction is set, but a progress measure is not linked yet."
                  : "The strategy has a progress measure, but no behaviour or scheduled task is linked to the objective."}
              </p>
              <button className="text-button" onClick={onRefine}>
                Work this out with Life OS →
              </button>
            </section>
          )}
        </>
      ) : (
        <section className="connection-gap">
          <h3>What would you like to be different?</h3>
          <p>
            {area.objectives[0]?.title ??
              "You do not need to optimise every area at once. Start here when it matters to you."}
          </p>
          <button onClick={onRefine}>Align {area.name}</button>
        </section>
      )}
      {focus && pathway && (
        <DetailSheet
          title={stages.find((s) => s.id === focus)?.label ?? "Your strategy"}
          onClose={() => setFocus(null)}
        >
          <nav className="meaning-breadcrumb" aria-label="Strategic context">
            <button className="text-button" onClick={() => setFocus("outcome")}>
              {area.name}
            </button>
            <span>/</span>
            <span>{objective?.title}</span>
          </nav>
          {focus === "outcome" && (
            <>
              <h3>{pathway.desiredDescription}</h3>
              <p>{objective?.description}</p>
              <dl>
                <dt>Starting point</dt>
                <dd>{pathway.currentDescription}</dd>
                <dt>Approved outcome</dt>
                <dd>{pathway.desiredDescription}</dd>
                <dt>Time horizon</dt>
                <dd>
                  {pathway.desiredDate?.toISOString().slice(0, 10) ??
                    "No fixed date"}
                </dd>
              </dl>
              <button
                className="text-button"
                onClick={() => setFocus("strategy")}
              >
                How are we getting there? →
              </button>
            </>
          )}
          {focus === "strategy" && (
            <>
              <p>{pathway.constraints}</p>
              {pathway.actions.map((a) => (
                <article className="detail-row" key={a.id}>
                  <h3>{a.title}</h3>
                  <p>{a.rationale}</p>
                  {a.expectedImpact && (
                    <details>
                      <summary>Expected impact</summary>
                      <p>{a.expectedImpact}</p>
                      <small>
                        This is the strategy’s expectation, not a measured
                        effect.
                      </small>
                    </details>
                  )}
                </article>
              ))}
              <button
                className="text-button"
                onClick={() => setFocus("actions")}
              >
                See linked behaviours →
              </button>
            </>
          )}
          {focus === "milestones" && (
            <>
              <p>
                Checkpoints from your approved pathway, in their configured
                order.
              </p>
              <ol className="milestone-progression">
                {pathway.milestones.map((m) => (
                  <li key={m.id} className={m.status.toLowerCase()}>
                    <small>
                      {m.status === "ACTIVE" ? "Next" : m.status.toLowerCase()}
                    </small>
                    <b>{m.title}</b>
                    <p>{m.description}</p>
                    {m.targetValue != null && (
                      <span>
                        Target: {m.targetValue} {m.unit}
                      </span>
                    )}
                  </li>
                ))}
              </ol>
              <p>
                {trajectoryLabel(status)}. {snapshot?.basis}
              </p>
              {snapshot?.estimateLowDate && (
                <p>
                  Estimated outcome window:{" "}
                  {snapshot.estimateLowDate.toISOString().slice(0, 10)} to{" "}
                  {snapshot.estimateHighDate?.toISOString().slice(0, 10)}.
                  Confidence: {snapshot.confidence.toLowerCase()}.
                </p>
              )}
              <button
                className="text-button"
                onClick={() => setFocus("measures")}
              >
                Inspect the evidence →
              </button>
            </>
          )}
          {focus === "measures" && (
            <>
              {bindings.map((b) => {
                const actual = metrics.find(
                  (e) => e.metricDefinitionId === b.metricDefinitionId,
                );
                return (
                  <article className="detail-row" key={b.id}>
                    <small>
                      {b.role === "PRIMARY"
                        ? "Primary measure"
                        : "Supporting measure"}
                    </small>
                    <h3>{b.metricDefinition.name}</h3>
                    <p>{b.rationale}</p>
                    <dl>
                      <dt>Latest recorded</dt>
                      <dd>
                        {metricValue(actual, b.metricDefinition.unit)}
                        {actual
                          ? ` · ${actual.localDate.toISOString().slice(0, 10)}`
                          : ""}
                      </dd>
                      {b.role === "PRIMARY" && (
                        <>
                          <dt>Next checkpoint</dt>
                          <dd>
                            {next?.targetValue != null
                              ? `${next.targetValue} ${next.unit ?? ""}`
                              : (next?.title ?? "Not defined")}
                          </dd>
                          <dt>Longer-term target</dt>
                          <dd>
                            {pathway.targetValue} {pathway.unit}
                          </dd>
                        </>
                      )}
                    </dl>
                  </article>
                );
              })}
              <p className="muted">
                The behaviours below share this objective. Their individual
                effect on a measure is not established.
              </p>
              <button
                className="text-button"
                onClick={() => setFocus("actions")}
              >
                See what you can do →
              </button>
            </>
          )}
          {focus === "actions" && (
            <>
              {behaviour.map((h) => (
                <article className="detail-row" key={h.id}>
                  <small>Repeated behaviour</small>
                  <h3>{h.name}</h3>
                  <p>{h.notes ?? `Linked to ${objective?.title}.`}</p>
                  <p>
                    {h.targetCount} per {h.targetPeriod} ·{" "}
                    {h.frequency.toLowerCase()}
                  </p>
                </article>
              ))}
              {tasks.map((t) => (
                <article className="detail-row" key={t.id}>
                  <small>Scheduled task</small>
                  <h3>{t.title}</h3>
                </article>
              ))}
              {behaviour.length + tasks.length === 0 && (
                <p>No daily execution is linked yet.</p>
              )}
              <Link href="/today">See what is scheduled today →</Link>
            </>
          )}
          <div className="detail-footer">
            <button
              className="quiet"
              onClick={() => {
                setFocus(null);
                onRefine?.();
              }}
            >
              Reconsider this with Life OS
            </button>
          </div>
        </DetailSheet>
      )}
    </section>
  );
}
