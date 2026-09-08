"use client";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { deriveInterviewProgress } from "@/lib/intelligence/interview-progress";
import { DetailSheet } from "./detail-sheet";
type Assertion = {
  id: string;
  category: string;
  content: string;
  source: string;
  confidence: string;
  rationale?: string | null;
  evidence?: unknown;
};
type Message = {
  id: string;
  role: string;
  content: string;
  clientTurnId?: string | null;
  turnStatus?: string;
  turnError?: string | null;
};
type Session = {
  id: string;
  lifeArea: { id?: string; name: string };
  messages: Message[];
  assertions: Assertion[];
};
const categories: Record<string, string> = {
  CURRENT: "Where you are",
  DESIRED: "What you want",
  MOTIVATION: "Why it matters",
  PRIORITY: "Priorities",
  CONSTRAINT: "Constraints",
  ANTI_GOAL: "What to protect",
  TENSION: "Possible tensions",
  UNCERTAINTY: "Open questions",
};
export function AlignmentConversation({
  initial,
  initialProgress,
  hasStrategy,
}: {
  initial: Session;
  initialProgress: ReturnType<typeof deriveInterviewProgress>;
  overall: Array<{ id: string; name: string; state: string }>;
  hasStrategy: boolean;
}) {
  const [session, setSession] = useState(initial),
    [text, setText] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [understanding, setUnderstanding] = useState(false),
    [correction, setCorrection] = useState<Assertion | null>(null),
    [intent, setIntent] = useState("WRONG"),
    [clarification, setClarification] = useState(""),
    [newIds, setNewIds] = useState<string[]>([]);
  const lock = useRef(false);
  const pendingTurn = useRef<{ content: string; id: string } | null>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  const draftKey = `life-os-alignment:${initial.id}`;
  const progress = useMemo(
    () =>
      deriveInterviewProgress(session.assertions, {
        current: initialProgress.dimensions.some(
          (x) => x.key === "current" && x.state === "CLEAR",
        ),
        desired: initialProgress.dimensions.some(
          (x) => x.key === "desired" && x.state === "CLEAR",
        ),
        constraints: initialProgress.dimensions.some(
          (x) => x.key === "constraints" && x.state === "CLEAR",
        ),
        measurement: initialProgress.dimensions.some(
          (x) => x.key === "measurement" && x.state === "CLEAR",
        ),
        strategy: hasStrategy,
      }),
    [session.assertions, initialProgress, hasStrategy],
  );
  const question =
    [...session.messages].reverse().find((m) => m.role === "ASSISTANT")
      ?.content ??
    (hasStrategy
      ? "What has changed, or deserves a different priority now?"
      : `What would you like to be different about ${session.lifeArea.name.toLowerCase()}?`);
  const lastUser = [...session.messages]
    .reverse()
    .find((m) => m.role === "USER");
  const failed =
    lastUser && ["TIMED_OUT", "FAILED"].includes(lastUser.turnStatus ?? "")
      ? lastUser
      : null;
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(draftKey);
      if (saved) setText(saved);
      const pending = sessionStorage.getItem(`${draftKey}:turn`);
      if (pending) pendingTurn.current = JSON.parse(pending);
    } catch {
      /* A stale draft must not prevent the persisted screen from opening. */
    }
  }, [draftKey]);
  function updateText(value: string) {
    setText(value);
    sessionStorage.setItem(draftKey, value);
  }
  async function submit(content = text, id?: string) {
    if (!content.trim() || lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    setNotice("");
    const identity =
      id ??
      (pendingTurn.current?.content === content
        ? pendingTurn.current.id
        : crypto.randomUUID());
    pendingTurn.current = { content, id: identity };
    sessionStorage.setItem(
      `${draftKey}:turn`,
      JSON.stringify(pendingTurn.current),
    );
    try {
      const response = await fetch("/api/alignment/turn", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: session.id,
          content,
          clientTurnId: identity,
        }),
      });
      const data = await response.json();
      const next = data.session ?? data;
      if (next?.messages) setSession(next);
      if (!response.ok) throw new Error("response");
      const turn = next.messages.find(
        (m: Message) => m.clientTurnId === identity,
      );
      if (turn?.turnStatus !== "COMPLETED") throw new Error("pending");
      const added = next.assertions.filter(
        (a: Assertion) => !session.assertions.some((old) => old.id === a.id),
      );
      setNewIds(added.map((a: Assertion) => a.id));
      setNotice(
        added.length
          ? `${added.length} ${added.length === 1 ? "understanding updated" : "understandings updated"}. Review what changed.`
          : "Answer saved. Your next question is ready.",
      );
      updateText("");
      pendingTurn.current = null;
      sessionStorage.removeItem(`${draftKey}:turn`);
    } catch {
      setError(
        "Life OS could not complete this response. Retry the same answer; you do not need to re-enter it.",
      );
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  async function correct() {
    if (!correction || lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/alignment/correction", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: session.id,
          assertionId: correction.id,
          intent: `${intent}: ${correction.content}${clarification.trim() ? `\nUser clarification: ${clarification.trim()}` : ""}`,
        }),
      });
      if (!response.ok) throw new Error();
      const data = await response.json();
      setSession((s) => ({
        ...s,
        messages: data.message ? [...s.messages, data.message] : s.messages,
        assertions: s.assertions.filter((a) => a.id !== correction.id),
      }));
      setNotice(
        "Correction saved. This statement is no longer used in the current understanding; its history is preserved.",
      );
      setCorrection(null);
      setClarification("");
    } catch {
      setError(
        "The correction was not confirmed. The statement remains in place. Try again.",
      );
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return (
    <section
      id="conversation"
      className="alignment-consultation"
      aria-label={`Alignment interview for ${session.lifeArea.name}`}
    >
      <div className="consultation-heading">
        <div>
          <p className="eyebrow">
            {hasStrategy ? "Refine your direction" : "Align this area"}
          </p>
          <h2>
            {hasStrategy ? "What has changed?" : "Let’s find what matters."}
          </h2>
        </div>
        <button className="quiet" onClick={() => setUnderstanding(true)}>
          What Life OS understands <span>{session.assertions.length}</span>
        </button>
      </div>
      <div className="consultation-grid">
        <div className="consultation-main">
          <div className="interview-progress-note">
            <span>
              {hasStrategy
                ? "Active strategy"
                : progress.ready
                  ? "Ready to shape a strategy"
                  : "Understanding your direction"}
            </span>
            <details>
              <summary>What is still open?</summary>
              <ul>
                {progress.dimensions.map((d) => (
                  <li key={d.key}>
                    {d.label}:{" "}
                    {d.state === "CLEAR"
                      ? "understood"
                      : d.state === "DEVELOPING"
                        ? "taking shape"
                        : "not yet clear"}
                  </li>
                ))}
              </ul>
            </details>
          </div>
          {progress.ready && (
            <section className="synthesis-ready">
              <h3>
                {hasStrategy
                  ? "Ready to reconsider the approach?"
                  : "Your direction is taking shape."}
              </h3>
              <p>
                Review your understanding before creating a proposal. Nothing
                becomes active without approval.
              </p>
              <Link
                className="button"
                href={`/intelligence?lifeAreaId=${session.lifeArea.id ?? ""}`}
              >
                {hasStrategy
                  ? "Review a strategy change →"
                  : "Review and build my strategy →"}
              </Link>
            </section>
          )}
          <form
            className="consultation-question"
            onSubmit={(e) => {
              e.preventDefault();
              submit();
            }}
          >
            <p className="eyebrow">Next question</p>
            <h3>{question}</h3>
            <label>
              Your answer
              <textarea
                ref={input}
                rows={4}
                value={text}
                onChange={(e) => updateText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                    e.preventDefault();
                    submit();
                  }
                }}
                placeholder="Say what matters. It is okay not to know yet."
                disabled={busy}
              />
            </label>
            <div className="consultation-submit">
              <button disabled={busy || !text.trim()}>
                {busy ? "Preparing your next question…" : "Continue"}
              </button>
              <small>Ctrl / ⌘ + Enter</small>
            </div>
            <details>
              <summary>What we are clarifying</summary>
              <p>{progress.reason}</p>
            </details>
          </form>
          {busy && (
            <p role="status" className="processing-state">
              Your answer stays here while Life OS responds.
            </p>
          )}
          {(error || failed) && (
            <section role="alert" className="error-notice">
              <b>
                {failed
                  ? "Your answer is saved."
                  : "Your answer is kept on this device."}
              </b>
              <p>
                {error ||
                  "The previous response did not complete. Retry when you are ready."}
              </p>
              <button
                className="quiet"
                disabled={busy}
                onClick={() =>
                  submit(
                    failed?.content ?? pendingTurn.current?.content ?? text,
                    failed?.clientTurnId ?? pendingTurn.current?.id,
                  )
                }
              >
                Try again
              </button>
            </section>
          )}
          {notice && (
            <div role="status" className="success-note">
              <p>{notice}</p>
              <button
                className="text-button"
                onClick={() => setUnderstanding(true)}
              >
                Review understanding →
              </button>
            </div>
          )}
          <details className="quiet-details">
            <summary>
              Conversation history · {session.messages.length} messages
            </summary>
            {session.messages.map((m) => (
              <article key={m.id}>
                <small>
                  {m.role === "USER"
                    ? "You"
                    : m.role === "CORRECTION"
                      ? "Correction"
                      : "Life OS"}
                </small>
                <p>{m.content}</p>
              </article>
            ))}
          </details>
        </div>
        <div className="consultation-context">
          <p className="eyebrow">Keep in view</p>
          {session.assertions
            .filter((a) =>
              ["DESIRED", "PRIORITY", "CONSTRAINT"].includes(a.category),
            )
            .slice(0, 3)
            .map((a) => (
              <div key={a.id}>
                <small>{categories[a.category]}</small>
                <p>{a.content}</p>
              </div>
            ))}
          <button
            className="text-button"
            onClick={() => setUnderstanding(true)}
          >
            Inspect or correct the full picture →
          </button>
          <p className="muted">
            Changing understanding does not silently change an approved
            strategy.
          </p>
        </div>
      </div>
      {understanding && (
        <DetailSheet
          title="What Life OS understands"
          onClose={() => setUnderstanding(false)}
        >
          <p>Review the facts and assumptions the conversation is using.</p>
          {session.assertions.length === 0 ? (
            <p className="empty">
              Your first answer starts the picture. Nothing has been inferred
              yet.
            </p>
          ) : (
            session.assertions.map((a) => (
              <article
                key={a.id}
                className={`understanding-statement ${newIds.includes(a.id) ? "recent-understanding" : ""}`}
              >
                <small>
                  {categories[a.category] ?? "Context"} ·{" "}
                  {a.source === "STATED"
                    ? "You said"
                    : a.source === "OBSERVED"
                      ? "From recorded context"
                      : "Working hypothesis"}
                  {newIds.includes(a.id) ? " · Updated" : ""}
                </small>
                <p>{a.content}</p>
                {a.source === "INFERRED" && (
                  <span>
                    Confidence:{" "}
                    {a.confidence.toLowerCase().replaceAll("_", " ")}
                  </span>
                )}
                {a.rationale && (
                  <details>
                    <summary>Why Life OS thinks this</summary>
                    <p>{a.rationale}</p>
                    {Array.isArray(a.evidence) && (
                      <small>
                        References:{" "}
                        {a.evidence
                          .filter((e) => typeof e === "string")
                          .join(", ")}
                      </small>
                    )}
                  </details>
                )}
                <button
                  className="text-button"
                  onClick={() => {
                    setUnderstanding(false);
                    setCorrection(a);
                    setIntent("WRONG");
                  }}
                >
                  Correct this
                </button>
              </article>
            ))
          )}
        </DetailSheet>
      )}
      {correction && (
        <DetailSheet
          title="Correct understanding"
          onClose={() => setCorrection(null)}
        >
          <blockquote>{correction.content}</blockquote>
          <label>
            What needs to change?
            <select value={intent} onChange={(e) => setIntent(e.target.value)}>
              <option value="WRONG">This is wrong</option>
              <option value="NO LONGER TRUE">This used to be true</option>
              <option value="CLARIFY">This needs clarification</option>
              <option value="THIS MATTERS MORE">This matters more now</option>
              <option value="THIS MATTERS LESS">This matters less now</option>
              <option value="THIS IS ONLY A HYPOTHESIS">
                This is only a hypothesis
              </option>
              <option value="REMOVE">Remove from current understanding</option>
            </select>
          </label>
          <label>
            What should Life OS know instead?
            <textarea
              value={clarification}
              onChange={(e) => setClarification(e.target.value)}
              rows={3}
            />
          </label>
          <p className="muted">
            The original stays in history. It will be retired from the current
            picture, and your correction will inform the next conversation.
          </p>
          {error && (
            <p role="alert" className="error-notice">
              {error}
            </p>
          )}
          <button onClick={correct} disabled={busy}>
            {busy ? "Saving correction…" : "Save correction"}
          </button>
        </DetailSheet>
      )}
    </section>
  );
}
