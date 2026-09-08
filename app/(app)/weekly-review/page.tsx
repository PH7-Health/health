import Link from "next/link";
import { requireUser } from "@/lib/auth/session";
import { getWeeklyReview } from "@/lib/life-os/service";
import { prisma } from "@/lib/db/prisma";
import { weekStart } from "@/lib/life-os/date";
import { AskLifeOs } from "@/components/ask-life-os";
import { SaveReflection } from "@/components/save-reflection";
import { PendingButton } from "@/components/pending-button";
import { generateWeeklyCoachAction } from "./actions";
import type { WeeklyCoaching } from "@/lib/intelligence/coaching-schema";
export default async function WeeklyReviewPage() {
  const user = await requireUser();
  const [review, execution] = await Promise.all([
    getWeeklyReview(user.id),
    prisma.aIExecution.findFirst({
      where: {
        userId: user.id,
        operation: "weekly_coaching",
        createdAt: { gte: weekStart() },
      },
      orderBy: { createdAt: "desc" },
    }),
  ]);
  const coach =
    execution?.output &&
    typeof execution.output === "object" &&
    "answer" in execution.output
      ? (execution.output as { answer: WeeklyCoaching }).answer
      : null;
  const recommendations = review.recommendations as Array<{
    title: string;
    detail: string;
  }>;
  const neglected = review.neglected as Array<{ area: string; reason: string }>;
  const snapshot = review.snapshot as {
    scores?: Array<{ date: string; score: number }>;
  };
  const days = snapshot.scores?.length ?? 0;
  return (
    <div className="page review-page">
      <section className="section-intro">
        <div>
          <p className="eyebrow">
            {review.weekStart.toISOString().slice(0, 10)} to{" "}
            {review.weekEnd.toISOString().slice(0, 10)}
          </p>
          <h2>
            {days < 3
              ? "A week still taking shape."
              : "What deserves to change?"}
          </h2>
          <p>
            {days} recorded {days === 1 ? "day" : "days"} ·{" "}
            {review.overallScore}/100 average completion
            {days < 3 ? " · Too little evidence for a broad conclusion." : "."}
          </p>
        </div>
        <Link className="button quiet" href="/alignment">
          Review your direction →
        </Link>
      </section>
      <section className="review-decision">
        <p className="eyebrow">A decision to consider</p>
        <h3>{recommendations[0]?.title ?? "No change required"}</h3>
        <p>
          {recommendations[0]?.detail ??
            "There is no new recommendation from the recorded evidence."}
        </p>
        <details>
          <summary>What supports this?</summary>
          {neglected.length ? (
            neglected.map((n) => (
              <p key={n.area}>
                <b>{n.area}</b>: {n.reason}
              </p>
            ))
          ) : (
            <p>No missing area was identified by this calculation.</p>
          )}
          <p>
            Missing records do not prove that an area was neglected in real
            life.
          </p>
        </details>
        <Link href="/alignment">Review before changing priorities →</Link>
      </section>
      <div className="weekly-observations">
        <section>
          <p className="eyebrow">Improving signals</p>
          <p>
            {(review.improved as string[]).join(", ") ||
              "No established improvement this week."}
          </p>
        </section>
        <section>
          <p className="eyebrow">Deteriorating signals</p>
          <p>
            {(review.deteriorated as string[]).join(", ") ||
              "No established deterioration this week."}
          </p>
        </section>
      </div>
      <SaveReflection initial={review.reflection} />
      <section className="review-coach">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Optional deeper interpretation</p>
            <h3>Discuss the week with Life OS</h3>
          </div>
          <AskLifeOs
            prompts={[
              "What should stay the same next week?",
              "What deserves less attention?",
            ]}
          />
        </div>
        {coach ? (
          <details className="saved-review">
            <summary>Read this week’s saved interpretation</summary>
            <p className="muted">
              Saved {execution?.createdAt.toISOString().slice(0, 10)} ·{" "}
              {execution?.provider} · confidence{" "}
              {coach.confidence.toLowerCase().replaceAll("_", " ")}. Reflects
              the evidence available at generation.
            </p>
            <h3>{coach.weekInOneSentence}</h3>
            <p>{coach.biggestWin}</p>
            <p>{coach.biggestConcern}</p>
            <h4>Priorities to consider</h4>
            <ol>
              {coach.priorities.slice(0, 3).map((p) => (
                <li key={p.action}>{p.action}</li>
              ))}
            </ol>
            {[
              ["Continue", coach.continue],
              ["Change", coach.change],
              ["Working", coach.working],
              ["Possible limiters", coach.possibleLimiters],
              ["Trade-offs", coach.tradeOffs],
              ["Missing evidence", coach.missingInformation],
            ].map(([title, values]) => (
              <details key={String(title)}>
                <summary>{String(title)}</summary>
                {(values as string[]).map((value) => (
                  <p key={value}>{value}</p>
                ))}
              </details>
            ))}
          </details>
        ) : (
          <form action={generateWeeklyCoachAction}>
            <p className="muted">
              An explicit AI request using this week’s recorded evidence. The
              result is saved for reopening.
            </p>
            <PendingButton pendingLabel="Preparing this week’s interpretation…">
              Generate this week’s interpretation
            </PendingButton>
          </form>
        )}
      </section>
    </div>
  );
}
