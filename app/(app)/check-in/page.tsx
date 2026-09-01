import { requireUser } from "@/lib/auth/session";
import { getTodayView } from "@/lib/life-os/service";
import { CheckInFlow } from "@/components/check-in-flow";

export default async function CheckInPage() { const user = await requireUser(); const state = await getTodayView(user.id); const entries = new Map(state.entries.map((entry) => [entry.metricDefinitionId, entry])); const initial=Object.fromEntries(state.metrics.map(metric=>{const entry=entries.get(metric.id);return [metric.key,entry?.valueNumber?.toString()??entry?.valueText??(entry?.valueBoolean==null?"":String(entry.valueBoolean))]})); return <div className="page narrow"><section className="hero compact"><div><p className="eyebrow">Check-in</p><h2>One signal at a time.</h2><p>Fast enough to use. Clear enough to matter.</p></div><div className="score simple"><strong>{state.score}</strong><span>current score</span></div></section><CheckInFlow metrics={state.metrics} initial={initial} score={state.score}/></div>; }
