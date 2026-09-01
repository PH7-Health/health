"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { completeAction } from "@/app/(app)/actions";

type Item = { id: string; title: string; meta: string; type: "task" | "habit" | "supplement"; done: boolean };
type MetricDetail = { ratio: number; target: string; actual: string; reason: string };
type Part = { label: string; expected: number; completed: number; weight: number; contribution?: number; details?: MetricDetail | null };

export function TodayControl({ score, status, parts, items }: { score: number; status: string; parts: Part[]; items: Item[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState<string | null>(null);
  const [local, setLocal] = useState(items);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const completed = local.filter((item) => item.done).length;
  const total = local.length;
  const liveScore = Math.min(100, score + Math.round((completed - items.filter((item) => item.done).length) * 100 / Math.max(total, 1)));

  const complete = (item: Item) => {
    if (item.done || busy) return;
    setError(""); setBusy(item.id);
    setLocal((current) => current.map((value) => value.id === item.id ? { ...value, done: true } : value));
    void (async () => {
      try { const result = await completeAction(item.type, item.id); if (!result.ok) throw new Error(result.error); router.refresh(); }
      catch { setLocal((current) => current.map((value) => value.id === item.id ? { ...value, done: false } : value)); setError("Could not save that completion. Try again."); }
      finally { setBusy(null); }
    })();
  };

  return <>
    <section className="today-instrument"><button className="score-orbit" onClick={() => setOpen(true)} aria-label="Explore today’s score"><svg viewBox="0 0 120 120"><circle cx="60" cy="60" r="52" /><circle className="progress" cx="60" cy="60" r="52" pathLength="100" style={{ strokeDasharray: "100", strokeDashoffset: 100 - liveScore }} /></svg><span><strong>{liveScore}</strong><small>{status.replaceAll("_", " ")}</small></span></button><div><p className="eyebrow">Today’s control surface</p><h2>{total - completed} actions remain.</h2><p>Complete the essentials. The system updates as your day moves.</p></div></section>
    <section className="action-console"><div className="console-head"><span>{completed}/{total} complete</span><i><b style={{ width: `${total ? completed / total * 100 : 0}%` }} /></i></div>{error ? <p className="notice" role="alert">{error}</p> : null}{local.map((item) => <button className={`action-tile ${item.done ? "done" : ""}`} key={item.id} disabled={item.done || busy === item.id} onClick={() => complete(item)}><span className="action-check">{item.done ? "✓" : ""}</span><span><strong>{item.title}</strong><small>{item.meta}</small></span><em>{busy === item.id ? "Saving" : item.done ? "Done" : "Complete"}</em></button>)}</section>
    {open ? <div className="score-sheet" role="dialog" aria-modal="true" aria-label="Score explanation"><button className="sheet-backdrop" onClick={() => setOpen(false)} aria-label="Close score detail" /><article><button className="close" onClick={() => setOpen(false)}>Close</button><p className="eyebrow">Today {liveScore}</p><h3>Score layers</h3>{parts.filter((part) => !part.label.startsWith("Metric ·")).map((part) => { const rows = local.filter((item) => item.meta === part.label || part.label === "Health" && item.type === "supplement"); const contribution = part.contribution ?? Math.round(part.completed / Math.max(part.expected, 1) * part.weight); const metrics = part.label === "Health" ? parts.filter((item) => item.details) : []; return <div key={part.label} className={`score-layer ${active === part.label ? "selected" : ""}`}><button onClick={() => setActive(active === part.label ? null : part.label)}><span>{part.label}<small>Expected {part.expected} · Completed {part.completed}</small></span><strong>{contribution}/{Math.round(part.weight)}</strong></button>{active === part.label ? <div><p>{rows.length ? rows.map((item) => `${item.title}: expected 1, ${item.done ? "completed 1" : "completed 0"}`).join(" · ") : "No scored action recorded for this area."}</p>{metrics.map((metricPart) => { const metric = metricPart.details!; const metricContribution = metricPart.contribution ?? Math.round(metricPart.completed / Math.max(metricPart.expected, 1) * metricPart.weight); return <button key={metricPart.label} className="score-explanation" onClick={() => setActive(active === metricPart.label ? "Health" : metricPart.label)}><b>{metricPart.label.replace("Metric · ", "")}</b><span>Target: {metric.target}</span><span>Actual: {metric.actual}</span><span>Contribution: {metricContribution}/{Math.round(metricPart.weight)}</span><p>{metric.reason}</p></button>; })}</div> : null}</div>; })}</article></div> : null}
  </>;
}
