import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { resumeAlignmentSession, getAlignmentSession } from "@/lib/intelligence/alignment";
import { getAlignmentCommand } from "@/lib/intelligence/alignment-command";
import { deriveInterviewProgress } from "@/lib/intelligence/interview-progress";
import { AlignmentConversation } from "@/components/alignment-conversation";
import { AlignmentCommandCentre } from "@/components/alignment-command-centre";

export default async function AlignmentAreaPage({ params }: { params: Promise<{ lifeAreaId: string }> }) {
  const user = await requireUser(); const { lifeAreaId } = await params;
  const command = await getAlignmentCommand(user.id, lifeAreaId); if (!command) notFound();
  const resumed = await resumeAlignmentSession(user.id, lifeAreaId); const session = await getAlignmentSession(user.id, resumed.id); if (!session) notFound();
  const areas = await prisma.lifeArea.findMany({
    where: { userId: user.id, active: true },
    include: {
      alignmentSessions: { where: { status: "ACTIVE" }, orderBy: { updatedAt: "desc" }, take: 1, include: { assertions: { where: { active: true } } } },
      objectives: { where: { active: true }, include: { pathway: { include: { metrics: { where: { active: true } }, actions: { where: { active: true } } } } } }
    },
    orderBy: { sortOrder: "asc" }
  });
  const toProgress = (area: (typeof areas)[number]) => deriveInterviewProgress(area.alignmentSessions[0]?.assertions ?? [], { current: Boolean(area.objectives.some((item) => item.pathway?.currentDescription)), desired: Boolean(area.objectives.some((item) => item.pathway?.desiredDescription)), constraints: Boolean(area.objectives.some((item) => item.pathway?.constraints)), measurement: Boolean(area.objectives.some((item) => item.pathway?.metrics.length)), strategy: Boolean(area.objectives.some((item) => item.pathway?.status === "ACTIVE" && item.pathway.actions.length)) });
  const interviewPathway = command.pathways[0]?.pathway;
  const progress = deriveInterviewProgress(session.assertions, { current: Boolean(interviewPathway?.currentDescription), desired: Boolean(interviewPathway?.desiredDescription), constraints: Boolean(interviewPathway?.constraints), measurement: Boolean(interviewPathway?.metrics.length), strategy: Boolean(interviewPathway?.status === "ACTIVE" && interviewPathway.actions.length) });
  const overall = areas.map((area) => { const stage = toProgress(area).stage; return { id: area.id, name: area.name, state: stage === "READY" ? "ALIGNED" : stage === "EXPLORE" ? "UNEXPLORED" : stage === "SYNTHESISE" ? "NEEDS CLARIFICATION" : "DEVELOPING" }; });
  return <><AlignmentConversation initial={session} initialProgress={progress} overall={overall} hasStrategy={Boolean(interviewPathway?.status === "ACTIVE")} /><section id="strategy" className="alignment-strategy-context"><p className="eyebrow">Strategic context</p><AlignmentCommandCentre command={command} /></section></>;
}
