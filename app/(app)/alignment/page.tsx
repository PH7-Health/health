import Link from "next/link";
import { requireUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { trajectoryLabel } from "@/lib/life-os/experience";
export default async function AlignmentPage() {
  const user = await requireUser();
  const areas = await prisma.lifeArea.findMany({
    where: { userId: user.id, active: true },
    include: {
      objectives: {
        where: { active: true },
        include: {
          pathway: {
            include: {
              milestones: { orderBy: { sequence: "asc" } },
              trajectorySnapshots: { orderBy: { localDate: "desc" }, take: 1 },
            },
          },
        },
        orderBy: { priority: "asc" },
      },
    },
    orderBy: { sortOrder: "asc" },
  });
  const active = areas.flatMap((area) =>
    area.objectives
      .filter((o) => o.pathway?.status === "ACTIVE")
      .map((objective) => ({ area, objective, pathway: objective.pathway! })),
  );
  const concerns = active.filter(({ pathway }) =>
    ["BEHIND", "STALLED", "WATCH"].includes(
      pathway.trajectorySnapshots[0]?.status ?? pathway.trajectoryStatus,
    ),
  );
  return (
    <div className="page alignment-home">
      <section className="section-intro">
        <div>
          <p className="eyebrow">The life you want, made practical</p>
          <h2>
            Choose your direction.
            <br />
            Keep it in view.
          </h2>
          <p>
            {active.length
              ? `${active.length} active ${active.length === 1 ? "strategy" : "strategies"}. Refine what matters when life changes; let Today handle execution.`
              : "Start with one area that matters. Life OS will help you define a direction and a practical next step."}
          </p>
        </div>
        <Link className="button" href="/today">
          What matters today →
        </Link>
      </section>
      {concerns.length > 0 && (
        <section className="attention-strip">
          <p className="eyebrow">Worth your attention</p>
          {concerns.slice(0, 3).map(({ area, pathway }) => (
            <Link key={pathway.id} href={`/alignment/${area.id}`}>
              <b>{area.name}</b>
              <span>
                {trajectoryLabel(
                  pathway.trajectorySnapshots[0]?.status ??
                    pathway.trajectoryStatus,
                )}
              </span>
              <span>Review →</span>
            </Link>
          ))}
        </section>
      )}
      <section className="direction-list" aria-label="Life areas">
        {areas.map((area) => {
          const path = area.objectives.find(
            (o) => o.pathway?.status === "ACTIVE",
          )?.pathway;
          const next = path?.milestones.find((m) => m.status === "ACTIVE");
          return (
            <Link
              key={area.id}
              href={`/alignment/${area.id}`}
              className={`direction-row ${path ? "has-direction" : ""}`}
            >
              <div>
                <span className="eyebrow">
                  {path
                    ? "Active strategy"
                    : area.objectives.length
                      ? "Direction taking shape"
                      : "Open to explore"}
                </span>
                <h3>{area.name}</h3>
              </div>
              <div>
                <strong>
                  {path?.desiredDescription ??
                    area.objectives[0]?.title ??
                    "What would a good life here look like?"}
                </strong>
                <p>
                  {next
                    ? `Next: ${next.title}`
                    : path
                      ? "Review the next checkpoint."
                      : "Define this when it deserves your attention."}
                </p>
              </div>
              <span className="direction-status">
                {path
                  ? trajectoryLabel(
                      path.trajectorySnapshots[0]?.status ??
                        path.trajectoryStatus,
                    )
                  : "Explore"}{" "}
                <i>→</i>
              </span>
            </Link>
          );
        })}
      </section>
      <details className="quiet-details">
        <summary>How direction becomes a day</summary>
        <p>
          Tell Life OS where you are and what you want. Review the proposed
          strategy before approving it. Linked actions appear on Today;
          observations and reviews show whether the strategy needs to change.
        </p>
        <Link href="/settings">
          Need precise manual control? Advanced configuration →
        </Link>
      </details>
    </div>
  );
}
