"use client";
import { useRef, useState } from "react";
import Link from "next/link";
import { completeAction } from "@/app/(app)/actions";
import { DetailSheet } from "./detail-sheet";
import { ActionMeaning } from "./action-connection";
import type { ActionConnection } from "@/lib/life-os/experience";
export type TodayItem = {
  id: string;
  title: string;
  meta: string;
  type: "task" | "habit" | "supplement";
  done: boolean;
  rank: number;
  connection: ActionConnection;
};
type Part = {
  label: string;
  expected: number;
  completed: number;
  weight: number;
  contribution?: number;
  details?: {
    ratio: number;
    target: string;
    actual: string;
    reason: string;
  } | null;
};
export function TodayControl({
  score,
  parts,
  items,
}: {
  score: number;
  status: string;
  parts: Part[];
  items: TodayItem[];
}) {
  const [confirmed, setConfirmed] = useState<Record<string, boolean>>({});
  const [pending, setPending] = useState<string[]>([]);
  const inFlight = useRef(new Set<string>());
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [scoreOpen, setScoreOpen] = useState(false);
  const [detail, setDetail] = useState<TodayItem | null>(null);
  const [savedScore, setSavedScore] = useState<number | null>(null);
  const [savedParts, setSavedParts] = useState<Part[] | null>(null);
  const local = items.map((i) => ({
    ...i,
    done: i.done || confirmed[i.id] || pending.includes(i.id),
  }));
  const completed = local.filter((i) => i.done).length;
  const remaining = local.filter((i) => !i.done);
  const focus = remaining
    .filter((i) => i.type !== "supplement")
    .sort((a, b) => a.rank - b.rank)
    .slice(0, 3);
  const rest = local.filter((i) => !focus.some((f) => f.id === i.id));
  async function complete(item: TodayItem) {
    if (item.done || inFlight.current.size > 0) return;
    inFlight.current.add(item.id);
    setPending((p) => [...p, item.id]);
    setError("");
    setNotice("");
    try {
      const result = await completeAction(item.type, item.id);
      if (!result.ok) throw new Error(result.error);
      setConfirmed((p) => ({ ...p, [item.id]: true }));
      setSavedScore(result.score);
      setSavedParts(result.parts);
      setNotice(`${item.title} saved.`);
    } catch {
      setError(
        `Could not confirm ${item.title}. Your screen has been restored. Retry safely to confirm the saved state.`,
      );
    } finally {
      inFlight.current.delete(item.id);
      setPending((p) => p.filter((id) => id !== item.id));
    }
  }
  const row = (item: TodayItem, index?: number) => (
    <article
      key={item.id}
      className={`daily-action ${item.done ? "is-done" : ""}`}
    >
      <button
        className="completion-toggle"
        onClick={() => complete(item)}
        disabled={item.done || pending.length > 0}
        aria-label={`${item.done ? "Completed" : "Complete"} ${item.title}`}
      >
        <span aria-hidden="true">
          {item.done ? "✓" : index != null ? `0${index + 1}` : ""}
        </span>
      </button>
      <div>
        <strong>{item.title}</strong>
        <small>
          {pending.includes(item.id)
            ? "Saving…"
            : item.done
              ? "Completed"
              : item.connection.objective
                ? `${item.connection.area} · ${item.connection.objective}`
                : item.meta}
        </small>
      </div>
      <button
        className="text-button"
        onClick={() => setDetail(item)}
        aria-label={`Why ${item.title}?`}
      >
        Why?
      </button>
    </article>
  );
  return (
    <>
      <section className="today-overview">
        <div>
          <p className="eyebrow">
            {remaining.length
              ? "Start with what matters"
              : "Your scheduled actions are complete"}
          </p>
          <h2>
            {completed === 0
              ? "A deliberate day starts here."
              : remaining.length
                ? `${completed} done. Keep the essentials moving.`
                : "Enough for today."}
          </h2>
          <p>
            {completed} of {items.length} scheduled actions recorded
            {pending.length ? " · Saving progress…" : "."}
          </p>
          <div
            className="completion-track"
            role="progressbar"
            aria-label="Actions completed"
            aria-valuenow={completed}
            aria-valuemax={items.length || 1}
          >
            <span
              style={{
                width: `${items.length ? (completed / items.length) * 100 : 0}%`,
              }}
            />
          </div>
        </div>
        <button
          className="today-score"
          onClick={() => setScoreOpen(true)}
          aria-label="Explore today's score"
        >
          <strong>{savedScore ?? score}</strong>
          <span>Daily score / 100</span>
          <small>
            {pending.length ? "Updates when saved" : "See calculation →"}
          </small>
        </button>
      </section>
      <section className="daily-focus">
        <div className="section-heading">
          <h3>{focus.length ? "What matters now" : "Daily rhythm"}</h3>
          <Link href="/check-in">Check in →</Link>
        </div>
        {focus.map((item, index) => row(item, index))}
        {focus.length === 0 && (
          <p className="muted">
            {remaining.length
              ? "Only your remaining protocol items are below."
              : "No need to add more just to fill the day."}
          </p>
        )}
      </section>
      {error && (
        <p className="error-notice" role="alert">
          {error}
        </p>
      )}
      <p className="sr-only" role="status">
        {notice}
      </p>
      {rest.length > 0 && (
        <details
          className="daily-rest"
          open={focus.length === 0 && remaining.length > 0}
        >
          <summary>
            Rest of the day{" "}
            <span>
              {rest.filter((i) => !i.done).length} remaining · {completed}{" "}
              completed
            </span>
          </summary>
          {rest.map((i) => row(i))}
        </details>
      )}
      {detail && (
        <DetailSheet title={detail.title} onClose={() => setDetail(null)}>
          <ActionMeaning connection={detail.connection} />
        </DetailSheet>
      )}
      {scoreOpen && (
        <DetailSheet
          title="What your daily score means"
          onClose={() => setScoreOpen(false)}
        >
          <p>
            Completion against your configured schedule and recorded metrics.
            This is a daily snapshot, not a verdict on your life or your
            long-term progress.
          </p>
          <div className="score-breakdown">
            {(savedParts ?? parts).map((part) => (
              <details key={part.label}>
                <summary>
                  <strong>{part.label.replace("Metric · ", "")}</strong>
                  <span>
                    {part.details
                      ? `${Math.round(part.details.ratio * 100)}% of target`
                      : `${part.completed}/${part.expected} complete`}
                  </span>
                </summary>
                {part.details ? (
                  <dl>
                    <dt>Target</dt>
                    <dd>{part.details.target}</dd>
                    <dt>Actual</dt>
                    <dd>{part.details.actual}</dd>
                    <dt>Reason</dt>
                    <dd>{part.details.reason}</dd>
                  </dl>
                ) : (
                  <ul>
                    {local
                      .filter((i) => i.meta === part.label)
                      .map((i) => (
                        <li key={i.id}>
                          {i.title}: {i.done ? "completed" : "not completed"}
                        </li>
                      ))}
                  </ul>
                )}
                <p>
                  Weighted contribution: {part.contribution ?? 0}/{part.weight}.
                  The overall score normalises across the included weights.
                </p>
              </details>
            ))}
          </div>
          <Link href="/dashboard">See progress over time →</Link>
        </DetailSheet>
      )}
    </>
  );
}
