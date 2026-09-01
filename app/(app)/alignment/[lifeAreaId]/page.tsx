import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { resumeAlignmentSession, getAlignmentSession } from "@/lib/intelligence/alignment";
import { AlignmentConversation } from "@/components/alignment-conversation";

export default async function AlignmentAreaPage({ params }: { params: Promise<{ lifeAreaId: string }> }) { const user = await requireUser(); const { lifeAreaId } = await params; const area = await prisma.lifeArea.findFirst({ where: { id: lifeAreaId, userId: user.id } }); if (!area) notFound(); const resumed = await resumeAlignmentSession(user.id, area.id); const session = await getAlignmentSession(user.id, resumed.id); if (!session) notFound(); return <AlignmentConversation initial={session} />; }
