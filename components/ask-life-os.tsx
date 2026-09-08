"use client";
import { useRef, useState } from "react";
import { DetailSheet } from "./detail-sheet";
type Answer = {
  status: string;
  answer: string;
  evidence: Array<{
    kind: string;
    claim: string;
    source: string;
    period: string;
    confidence: string;
  }>;
  hypotheses: Array<{
    hypothesis: string;
    evidenceSources: string[];
    confidence: string;
    uncertainty: string;
  }>;
  recommendations: Array<{ action: string; why: string; confidence: string }>;
  missingData: string[];
  confidence: string;
  continueCurrentStrategy: boolean;
};
export function AskLifeOs({
  pathwayId,
  lifeAreaId,
  prompts = [],
}: {
  pathwayId?: string;
  lifeAreaId?: string;
  prompts?: string[];
}) {
  const [open, setOpen] = useState(false),
    [question, setQuestion] = useState(""),
    [history, setHistory] = useState<
      Array<{ question: string; answer: Answer }>
    >([]),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const lock = useRef(false);
  async function ask(q: string) {
    if (!q.trim() || lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/intelligence/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: q,
          pathwayId,
          lifeAreaId,
          followUps: history
            .slice(-2)
            .map((x) => ({ question: x.question, answer: x.answer.answer })),
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error();
      setHistory((h) => [...h, { question: q, answer: data }]);
      setQuestion("");
    } catch {
      setError(
        "Life OS could not complete that answer. Your question is still here; try again.",
      );
      setQuestion(q);
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return (
    <div className="ask-entry">
      <button className="quiet" onClick={() => setOpen(true)}>
        Ask Life OS
      </button>
      {open && (
        <DetailSheet title="Ask Life OS" onClose={() => setOpen(false)}>
          <p className="muted">
            Ask about this part of your life. Opening this view does not
            generate an answer.
          </p>
          <div className="ask-prompts">
            {prompts.map((p) => (
              <button
                className="quiet"
                key={p}
                disabled={busy}
                onClick={() => ask(p)}
              >
                {p}
              </button>
            ))}
          </div>
          {history.map((item, i) => (
            <article className="ask-answer" key={i}>
              <h3>{item.question}</h3>
              <p>{item.answer.answer}</p>
              <small>
                Confidence:{" "}
                {item.answer.confidence.toLowerCase().replaceAll("_", " ")}
              </small>
              <details>
                <summary>Evidence and uncertainty</summary>
                {item.answer.evidence.map((e, n) => (
                  <p key={n}>
                    <b>{e.kind}</b>: {e.claim}
                    <small>
                      {e.source.replaceAll("_", " ")} · {e.period}
                    </small>
                  </p>
                ))}
                {item.answer.hypotheses.map((h, n) => (
                  <p key={n}>
                    <b>Hypothesis:</b> {h.hypothesis}
                    <small>
                      {h.confidence.toLowerCase()} confidence · {h.uncertainty}
                    </small>
                  </p>
                ))}
                {item.answer.missingData.map((m) => (
                  <p key={m}>Still needed: {m}</p>
                ))}
              </details>
              {item.answer.recommendations.map((r) => (
                <p key={r.action}>
                  <b>{r.action}</b>
                  <small>{r.why}</small>
                </p>
              ))}
            </article>
          ))}
          <form
            className="ask-question"
            onSubmit={(e) => {
              e.preventDefault();
              ask(question);
            }}
          >
            <label>
              Your question
              <textarea
                rows={3}
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="What matters here?"
              />
            </label>
            <button disabled={busy || !question.trim()}>
              {busy ? "Preparing an answer…" : "Ask"}
            </button>
          </form>
          {error && (
            <p role="alert" className="error-notice">
              {error}
            </p>
          )}
          {busy && <p role="status">Using your recorded evidence to answer.</p>}
        </DetailSheet>
      )}
    </div>
  );
}
