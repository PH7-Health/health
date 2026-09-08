"use client";
import Link from "next/link";
import { useState } from "react";
export function ProgressChart({
  points,
  title,
}: {
  points: Array<{ date: string; score: number }>;
  title: string;
}) {
  const [selected, setSelected] = useState(points.length - 1);
  const point = points[selected];
  return (
    <section className="progress-chart">
      <div className="section-heading">
        <h3>{title}</h3>
        <span>{points.length} recorded days</span>
      </div>
      {points.length ? (
        <>
          <div className="score-bars" aria-label={title}>
            {points.map((p, i) => (
              <button
                key={p.date}
                onClick={() => setSelected(i)}
                onFocus={() => setSelected(i)}
                aria-pressed={i === selected}
                aria-label={`${p.date}: ${p.score} out of 100`}
              >
                <span style={{ height: `${Math.max(3, p.score)}%` }} />
                <small>{p.date.slice(8)}</small>
              </button>
            ))}
          </div>
          <p className="chart-caption" aria-live="polite">
            {point?.date} · <strong>{point?.score}/100</strong>{" "}
            <Link href={`/today?date=${point?.date}`}>Inspect this day →</Link>
          </p>
          <p className="muted">
            Missing days are not plotted. This shows daily completion, not
            progress toward a life outcome.
          </p>
        </>
      ) : (
        <p className="empty">Record a day to begin seeing a pattern.</p>
      )}
    </section>
  );
}
