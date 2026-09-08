"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { saveCheckInResult } from "@/app/(app)/actions";
import { inputStep, recordedCount } from "@/lib/life-os/experience";
type Metric = {
  key: string;
  name: string;
  unit: string | null;
  valueType: string;
  decimalPrecision: number;
  description: string | null;
  selectOptions: unknown;
};
export function CheckInFlow({
  metrics,
  initial,
  score,
  draftKey,
}: {
  metrics: Metric[];
  initial: Record<string, string>;
  score: number;
  draftKey: string;
}) {
  const [step, setStep] = useState(0);
  const [values, setValues] = useState(initial);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState<number | null>(null);
  const [ready, setReady] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const lock = useRef(false);
  const beforeScore = useRef(score);
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(draftKey);
      if (raw) {
        const draft = JSON.parse(raw);
        if (draft.values && typeof draft.values === "object")
          setValues({ ...initial, ...draft.values });
      }
    } catch {
      /* A stale draft must not prevent the persisted screen from opening. */
    }
    setReady(true);
  }, [draftKey, initial]);
  useEffect(() => {
    if (ready && saved == null)
      sessionStorage.setItem(draftKey, JSON.stringify({ values }));
  }, [draftKey, values, ready, saved]);
  const metric = metrics[step];
  const set = (v: string) => {
    setError("");
    setValues((old) => ({ ...old, [metric.key]: v }));
  };
  const next = () => {
    const raw = values[metric.key] ?? "";
    if (
      raw !== "" &&
      !["BOOLEAN", "TEXT", "SELECT"].includes(metric.valueType) &&
      (!Number.isFinite(Number(raw)) ||
        (metric.valueType === "INTEGER" && !Number.isInteger(Number(raw))))
    ) {
      setError("Enter a valid value, or leave it blank to skip.");
      return;
    }
    setError("");
    setStep((s) => s + 1);
    requestAnimationFrame(() => heading.current?.focus());
  };
  async function save() {
    if (lock.current) return;
    lock.current = true;
    setPending(true);
    setError("");
    try {
      const data = new FormData();
      Object.entries(values).forEach(([k, v]) => data.set(k, v));
      const result = await saveCheckInResult(data);
      if (!result.ok) throw new Error(result.error);
      setSaved(result.score);
      sessionStorage.removeItem(draftKey);
    } catch {
      setError(
        "Your check-in could not be confirmed. Your values are still here; try saving again.",
      );
    } finally {
      lock.current = false;
      setPending(false);
    }
  }
  const count = recordedCount(values);
  if (saved != null)
    return (
      <section className="check-finish" role="status">
        <p className="eyebrow">Saved for today</p>
        <h2>Check-in complete.</h2>
        <p>
          {count} {count === 1 ? "value" : "values"} saved.{" "}
          {metrics.length - count > 0
            ? `${metrics.length - count} left unrecorded.`
            : ""}
        </p>
        <div className="score-change">
          <span>
            Before <b>{beforeScore.current}</b>
          </span>
          <i>→</i>
          <span>
            Now <b>{saved}</b>
          </span>
        </div>
        <p className="muted">
          {saved === beforeScore.current
            ? "Your observations are saved; the score did not change."
            : "Today’s score has been recalculated from your recorded data."}
        </p>
        <Link className="button" href="/today?checkedIn=1">
          Return to Today →
        </Link>
      </section>
    );
  if (step === metrics.length)
    return (
      <section className="check-finish">
        <p className="eyebrow">Review before saving</p>
        <h2>
          {count} {count === 1 ? "value" : "values"} ready.
        </h2>
        <p>
          Skipped values remain unknown. Nothing is saved until you confirm.
        </p>
        <dl className="check-review">
          {metrics.map((m, i) => (
            <div key={m.key}>
              <dt>{m.name}</dt>
              <dd>
                {values[m.key] === "true"
                  ? "Yes"
                  : values[m.key] === "false"
                    ? "No"
                    : values[m.key] || "Skipped"}{" "}
                {values[m.key] ? m.unit : ""}
              </dd>
              <button className="text-button" onClick={() => setStep(i)}>
                Edit {m.name}
              </button>
            </div>
          ))}
        </dl>
        {error && (
          <p role="alert" className="error-notice">
            {error}
          </p>
        )}
        <button disabled={pending || count === 0} onClick={save}>
          {pending ? "Saving check-in…" : "Save check-in"}
        </button>
        {count === 0 && (
          <Link href="/today">Nothing to record? Return to Today.</Link>
        )}
      </section>
    );
  const value = values[metric.key] ?? "";
  const rating = metric.valueType === "SCALE_1_10";
  const boolean = metric.valueType === "BOOLEAN";
  const textual = ["TEXT", "SELECT"].includes(metric.valueType);
  const increment = inputStep(metric.decimalPrecision, metric.valueType);
  const options = Array.isArray(metric.selectOptions)
    ? metric.selectOptions.filter((o): o is string => typeof o === "string")
    : [];
  return (
    <section className="check-flow">
      <div className="flow-progress">
        <span>
          {step + 1} of {metrics.length}
        </span>
        <span>{count} entered</span>
        <progress
          value={step}
          max={metrics.length}
          aria-label="Check-in progress"
        />
      </div>
      <div className="check-question" key={metric.key}>
        <p className="eyebrow">
          Today’s observation{metric.unit ? ` / ${metric.unit}` : ""}
        </p>
        <h2 ref={heading} tabIndex={-1}>
          {metric.name}
        </h2>
        <p className="muted">
          {initial[metric.key]
            ? `Recorded today: ${initial[metric.key]} ${metric.unit ?? ""}`
            : "Leave blank if you do not know. Skipping is okay."}
        </p>
        {rating ? (
          <fieldset className="rating-control">
            <legend className="sr-only">Rate {metric.name} from 1 to 10</legend>
            {Array.from({ length: 10 }, (_, i) => (
              <button
                key={i}
                aria-pressed={Number(value) === i + 1}
                className={Number(value) === i + 1 ? "selected" : ""}
                onClick={() => set(String(i + 1))}
              >
                {i + 1}
              </button>
            ))}
          </fieldset>
        ) : boolean ? (
          <div className="segment" aria-label={metric.name}>
            {["Yes", "No"].map((label, i) => (
              <button
                key={label}
                aria-pressed={value === String(!i)}
                className={value === String(!i) ? "selected" : ""}
                onClick={() => set(String(!i))}
              >
                {label}
              </button>
            ))}
          </div>
        ) : textual ? (
          options.length ? (
            <label>
              {metric.name}
              <select value={value} onChange={(e) => set(e.target.value)}>
                <option value="">Not recorded</option>
                {options.map((o) => (
                  <option key={o}>{o}</option>
                ))}
              </select>
            </label>
          ) : (
            <label>
              {metric.name}
              <textarea
                value={value}
                rows={3}
                onChange={(e) => set(e.target.value)}
              />
            </label>
          )
        ) : (
          <div className="stepper">
            <button
              aria-label={`Decrease ${metric.name}`}
              onClick={() =>
                set(String(Number((Number(value || 0) - increment).toFixed(4))))
              }
            >
              −
            </button>
            <label>
              <span className="sr-only">{metric.name}</span>
              <input
                type="number"
                inputMode={increment < 1 ? "decimal" : "numeric"}
                step={increment}
                value={value}
                onChange={(e) => set(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") next();
                }}
              />
            </label>
            <button
              aria-label={`Increase ${metric.name}`}
              onClick={() =>
                set(String(Number((Number(value || 0) + increment).toFixed(4))))
              }
            >
              +
            </button>
          </div>
        )}
        {metric.description && (
          <details className="quiet-details">
            <summary>Why record this?</summary>
            <p>{metric.description}</p>
          </details>
        )}
        {error && (
          <p className="error-notice" role="alert">
            {error}
          </p>
        )}
        <div className="flow-actions">
          <button
            className="quiet"
            disabled={step === 0}
            onClick={() => setStep((s) => s - 1)}
          >
            Back
          </button>
          <button onClick={next}>
            {step === metrics.length - 1
              ? "Review"
              : value === ""
                ? "Skip for now"
                : "Next"}
          </button>
        </div>
      </div>
    </section>
  );
}
