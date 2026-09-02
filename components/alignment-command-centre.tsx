import Link from "next/link";
import { AskLifeOs } from "@/components/ask-life-os";
import { displayMetric } from "@/lib/intelligence/alignment-command";

type Command = NonNullable<Awaited<ReturnType<typeof import("@/lib/intelligence/alignment-command").getAlignmentCommand>>>;

export function AlignmentCommandCentre({ command }: { command: Command }) {
  const { area, pathways, metrics } = command;
  const primary = pathways[0];
  const pathway = primary?.pathway;
  const objective = primary?.objective;
  const next = pathway?.milestones.find((item) => item.status === "ACTIVE");
  const snapshot = pathway?.trajectorySnapshots[0];
  const evidence = area.alignmentSessions[0]?.assertions ?? [];
  const current = evidence.filter((item) => item.category === "CURRENT").map((item) => item.content);
  const desired = evidence.filter((item) => ["DESIRED", "MOTIVATION", "PRIORITY", "CONSTRAINT", "ANTI_GOAL"].includes(item.category)).map((item) => item.content);
  const actions = pathway?.actions ?? [];
  const behaviours = area.habits.filter((habit) => !objective || habit.objectiveId === objective.id);
  const today = [...actions.map((action) => ({ title: action.title, why: action.rationale, kind: "Strategy action" })), ...behaviours.map((habit) => ({ title: habit.name, why: habit.notes || "This is a configured leading behaviour for this life area.", kind: "Behaviour" })), ...area.tasks.filter((task) => !objective || task.objectiveId === objective.id).map((task) => ({ title: task.title, why: "This active Today action is linked to this life area.", kind: "Today action" }))].slice(0, 3);
  const confidence = pathway?.confidence?.replaceAll("_", " ") ?? (evidence.length ? "MEDIUM" : "INSUFFICIENT DATA");
  const proposal = pathway?.proposals[0];

  return <div className="alignment-command">
    <section className="command-hero">
      <div><p className="eyebrow">Life area command centre</p><h2>{area.name}</h2><p>Direction, strategy and action in one connected view. Open any layer to inspect the evidence, challenge an assumption, or refine the plan.</p></div>
      <div className="command-confidence"><b>{confidence}</b><span>current evidence confidence</span></div>
    </section>
    <div className="strategy-spine" aria-label="Strategic progression"><span>Current</span><i>↓</i><span>Desired</span><i>↓</i><span>Gap</span><i>↓</i><span>Strategy</span><i>↓</i><span>Milestone</span><i>↓</i><strong>Now</strong></div>

    <section className="command-grid">
      <Explore title="Current reality" kicker="Where I am" ask={pathway ? "What evidence supports this current reality?" : "Help me define my current reality."} pathwayId={pathway?.id} lifeAreaId={area.id}>
        {pathway ? <p>{pathway.currentDescription}</p> : <Empty text="We have not defined your current reality yet." areaId={area.id} />}
        {current.length ? <Evidence items={evidence.filter((item) => item.category === "CURRENT")} /> : null}
        {metrics.length ? <div className="metric-strip">{pathway?.metrics.map((binding) => { const entry = metrics.find((item) => item.metricDefinitionId === binding.metricDefinitionId); return <span key={binding.id}><b>{binding.metricDefinition.name}</b>{entry ? displayMetric(entry, binding.metricDefinition.unit) : "No observation yet"}</span>; })}</div> : null}
      </Explore>
      <Explore title="Desired reality" kicker="Where I want to be" ask={pathway ? "Is this target realistic given my constraints?" : "Help me figure out what success looks like."} pathwayId={pathway?.id} lifeAreaId={area.id}>
        {pathway ? <p>{pathway.desiredDescription}</p> : <Empty text="We have not defined success yet." areaId={area.id} />}
        {desired.length ? <Evidence items={evidence.filter((item) => ["DESIRED", "MOTIVATION", "PRIORITY", "CONSTRAINT", "ANTI_GOAL"].includes(item.category))} /> : null}
      </Explore>
      <Explore title="The gap" kicker="What separates now from then" ask="What is the biggest constraint between where I am and where I want to be?" pathwayId={pathway?.id} lifeAreaId={area.id}>
        {pathway ? <p>{pathway.baselineValue != null && pathway.targetValue != null ? `${pathway.baselineValue}${pathway.unit ? ` ${pathway.unit}` : ""} → ${pathway.targetValue}${pathway.unit ? ` ${pathway.unit}` : ""}. ${pathway.direction === "DECREASE" ? "The target requires a lower measured value." : "The target requires a higher measured value."}` : "Current and desired states are defined, but the gap is not yet measured."}</p> : <Empty text="We need a current state and desired state before the gap can be made measurable." areaId={area.id} />}
      </Explore>
      <Explore title="Current strategy" kicker="The approach" ask="Why this strategy, and what alternative should I consider?" pathwayId={pathway?.id} lifeAreaId={area.id}>
        {actions.length ? <ul className="strategy-list">{actions.map((action) => <li key={action.id}><b>{action.title}</b><span>{action.rationale}</span></li>)}</ul> : <Empty text="We know the direction, but not yet the smallest reliable strategy." areaId={area.id} />}
        {pathway?.constraints ? <small>Constraint held: {pathway.constraints}</small> : null}
      </Explore>
      <Explore title="Next milestone" kicker="The next unlock" ask="Why is this the next milestone, and what controls the estimate?" pathwayId={pathway?.id} lifeAreaId={area.id}>
        {next ? <><h3>{next.title}</h3><p>{next.description || "An approved checkpoint on the active pathway."}</p><div className="trajectory"><b>{snapshot?.status?.replaceAll("_", " ") ?? pathway?.trajectoryStatus.replaceAll("_", " ")}</b><span>{snapshot?.basis || "More observations are needed before Life OS can estimate timing."}</span></div></> : <Empty text="We know the direction, but have not established the next measurable unlock." areaId={area.id} />}
      </Explore>
      <Explore title="What matters now" kicker="The highest-leverage variables" ask="What is the single highest-leverage variable right now?" pathwayId={pathway?.id} lifeAreaId={area.id}>
        {today.length ? <ol className="now-list">{today.map((item, index) => <li key={`${item.kind}-${item.title}`}><b>0{index + 1}</b><span><strong>{item.title}</strong><small>{item.kind} · {item.why}</small></span></li>)}</ol> : <Empty text="There is no linked action yet. Let Life OS help turn this direction into a practical next move." areaId={area.id} />}
      </Explore>
    </section>

    <section className="command-chain panel"><p className="eyebrow">Why this matters</p><h3>From today to life direction</h3>{today.length && objective ? <div className="causal-chain">{today.map((item) => <article key={item.title}><b>{item.title}</b><i>↓</i><span>{item.kind === "Behaviour" ? "Leading behaviour" : "Deliberate action"}</span><i>↓</i><span>{pathway?.metrics[0]?.metricDefinition.name || "Progress evidence still to be defined"}</span><i>↓</i><span>{next?.title || "Next milestone still to be defined"}</span><i>↓</i><strong>{objective.title}</strong><small>Configured links are shown as facts. Expected influence is a strategic hypothesis until supported by observations.</small></article>)}</div> : <Empty text="When an action, measure and milestone are linked, this chain will show exactly why the action matters." areaId={area.id} />}</section>

    {proposal ? <section className="proposal-inline"><p className="eyebrow">Life OS recommends</p><h3>{proposal.title}</h3><p>{proposal.rationale}</p><Link className="button" href="/intelligence">Review and approve proposal</Link></section> : null}
    <section className="command-controls"><div><p className="eyebrow">Shape the model</p><h3>Challenge or refine the strategy.</h3><p>Use Alignment when the answer changes direction. Use advanced configuration only for precise manual control.</p></div><AskLifeOs pathwayId={pathway?.id} lifeAreaId={area.id} prompts={["Why this?", "What would you do?", "Is this realistic?", "What is holding me back?"]} /><Link className="quiet button" href={`/alignment/${area.id}#conversation`}>Figure this out with Life OS</Link><Link className="quiet button" href="/settings">Advanced configuration</Link></section>
  </div>;
}

function Explore({ title, kicker, ask, pathwayId, lifeAreaId, children }: { title: string; kicker: string; ask: string; pathwayId?: string; lifeAreaId: string; children: React.ReactNode }) {
  return <details className="command-layer" open={title === "Current reality" || title === "What matters now"}><summary><span><small>{kicker}</small><strong>{title}</strong></span><i>+</i></summary><div className="command-layer-body">{children}<AskLifeOs pathwayId={pathwayId} lifeAreaId={lifeAreaId} prompts={[ask]} /></div></details>;
}
function Evidence({ items }: { items: Array<{ id: string; content: string; source: string; confidence: string }> }) { return <div className="evidence-list">{items.map((item) => <span key={item.id}><b>{item.source === "STATED" ? "You said" : item.source === "OBSERVED" ? "Observed" : "Life OS thinks"}</b>{item.content}{item.source === "INFERRED" ? <small>{item.confidence.replaceAll("_", " ")}</small> : null}</span>)}</div>; }
function Empty({ text, areaId }: { text: string; areaId: string }) { return <div className="command-empty"><p>{text}</p><Link href={`/alignment/${areaId}#conversation`}>Figure this out with Life OS →</Link></div>; }
