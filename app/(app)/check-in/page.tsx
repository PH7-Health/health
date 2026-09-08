import { requireUser } from "@/lib/auth/session";
import { getTodayView } from "@/lib/life-os/service";
import { CheckInFlow } from "@/components/check-in-flow";
export default async function CheckInPage() {
  const user = await requireUser();
  const state = await getTodayView(user.id);
  const entries = new Map(state.entries.map((e) => [e.metricDefinitionId, e]));
  const initial = Object.fromEntries(
    state.metrics.map((m) => {
      const e = entries.get(m.id);
      return [
        m.key,
        e?.valueNumber?.toString() ??
          e?.valueText ??
          (e?.valueBoolean == null ? "" : String(e.valueBoolean)),
      ];
    }),
  );
  return (
    <div className="page check-page">
      <CheckInFlow
        metrics={state.metrics}
        initial={initial}
        score={state.score}
        draftKey={`health-check-in:${user.id}:${state.date.toISOString().slice(0, 10)}`}
      />
    </div>
  );
}
