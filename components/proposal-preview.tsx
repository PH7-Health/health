import { pathwayProposalSchema } from "@/lib/intelligence/provider";
export function ProposalPreview({ payload }: { payload: unknown }) {
  const parsed = pathwayProposalSchema.safeParse(payload);
  if (!parsed.success)
    return (
      <p>
        Open the original proposal before deciding; its details could not be
        displayed safely.
      </p>
    );
  const p = parsed.data;
  return (
    <details className="quiet-details">
      <summary>Review exactly what would change</summary>
      <dl>
        <dt>Starting point</dt>
        <dd>{p.interpretedCurrentState}</dd>
        <dt>Desired outcome</dt>
        <dd>{p.interpretedDesiredState}</dd>
        <dt>Constraints</dt>
        <dd>{p.constraints.join("; ") || "No constraints supplied"}</dd>
      </dl>
      <h4>Proposed checkpoints</h4>
      <ol>
        {p.milestones.map((m) => (
          <li key={m.title}>
            <b>{m.title}</b>
            <p>{m.rationale}</p>
          </li>
        ))}
      </ol>
      <h4>Progress measure</h4>
      <p>{p.suggestedMetrics[0]?.name ?? "Not proposed"}</p>
      <h4>Proposed actions</h4>
      {p.pathwayActions.map((a) => (
        <p key={a.title}>
          <b>{a.title}</b>
          <br />
          {a.rationale}
        </p>
      ))}
      {p.assumptions.length > 0 && (
        <>
          <h4>Assumptions to review</h4>
          {p.assumptions.map((a) => (
            <p key={a}>{a}</p>
          ))}
        </>
      )}
      <p>
        Nothing here replaces the active strategy until you accept. The previous
        strategy remains in revision history.
      </p>
    </details>
  );
}
