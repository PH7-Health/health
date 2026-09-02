import Link from "next/link";
import { requireUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";

export default async function AlignmentPage() {
  const user = await requireUser();
  const areas = await prisma.lifeArea.findMany({ where: { userId: user.id, active: true }, include: { objectives: { where: { active: true }, include: { pathway: true } } }, orderBy: { sortOrder: "asc" } });
  return <div className="page alignment-index"><section className="command-hero"><div><p className="eyebrow">Alignment</p><h2>Build the life you mean to live.</h2><p>Life OS turns direction into strategy, today’s actions and a learning loop. Choose an area to see what is known, what matters now, and what still needs to be figured out.</p></div><div className="command-confidence"><b>{areas.length}</b><span>active life areas</span></div></section><section className="area-command-list">{areas.map((area) => { const route = area.objectives.find((objective) => objective.pathway?.status === "ACTIVE")?.pathway; return <Link href={`/alignment/${area.id}`} key={area.id}><small>{route?.trajectoryStatus.replaceAll("_", " ") || "DIRECTION TO DEFINE"}</small><strong>{area.name}</strong><span>{route?.desiredDescription || area.objectives[0]?.title || "Figure this out with Life OS"}</span><i>→</i></Link>; })}</section><section className="panel alignment-loop"><p className="eyebrow">How Life OS adapts</p><div><span>Alignment</span><i>↓</i><span>Strategy</span><i>↓</i><span>Today</span><i>↓</i><span>Data</span><i>↓</i><span>Weekly review</span></div></section></div>;
}
