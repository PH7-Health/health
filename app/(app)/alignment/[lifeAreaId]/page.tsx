import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { resumeAlignmentSession, getAlignmentSession } from "@/lib/intelligence/alignment";
import { getAlignmentCommand } from "@/lib/intelligence/alignment-command";
import { AlignmentConversation } from "@/components/alignment-conversation";
import { AlignmentCommandCentre } from "@/components/alignment-command-centre";

export default async function AlignmentAreaPage({ params }: { params: Promise<{ lifeAreaId: string }> }) {
  const user = await requireUser(); const { lifeAreaId } = await params;
  const command = await getAlignmentCommand(user.id, lifeAreaId); if (!command) notFound();
  const resumed = await resumeAlignmentSession(user.id, lifeAreaId); const session = await getAlignmentSession(user.id, resumed.id); if (!session) notFound();
  return <><AlignmentCommandCentre command={command} /><section id="conversation" className="alignment-conversation-wrap"><p className="eyebrow">Figure this out with Life OS</p><AlignmentConversation initial={session} /></section></>;
}
