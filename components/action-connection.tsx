import Link from "next/link";
import type { ActionConnection } from "@/lib/life-os/experience";
export function ActionMeaning({
  connection,
}: {
  connection: ActionConnection;
}) {
  return (
    <div className="action-meaning">
      <p>{connection.why}</p>
      {connection.objective ? (
        <>
          <div className="meaning-destination">
            <small>Serves</small>
            <strong>{connection.desired ?? connection.objective}</strong>
            <span>
              {connection.area} / {connection.objective}
            </span>
          </div>
          {connection.milestone && (
            <p>
              <b>Next checkpoint</b>
              <br />
              {connection.milestone}
            </p>
          )}
          {connection.measures.length > 0 && (
            <p>
              <b>How this objective is measured</b>
              <br />
              {connection.measures.join(", ")}
              <small className="muted">
                These measures share the objective; a direct effect from this
                action has not been established.
              </small>
            </p>
          )}
        </>
      ) : (
        <p className="empty">
          No strategic connection yet. Keep tracking it if it matters, or
          clarify its role.
        </p>
      )}
      <Link
        href={
          connection.areaId ? `/alignment/${connection.areaId}` : "/alignment"
        }
      >
        Review {connection.areaId ? connection.area : "your direction"} →
      </Link>
    </div>
  );
}
