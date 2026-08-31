import { prisma } from "@/lib/db/prisma";
import { evaluateDrift, getWeeklyReview } from "./service";

export type OutboundMessage = { recipient: string; subject: string; bodyText: string; triggerFingerprint: string; messageType: string };
export interface OutboundEmailProvider { send(message: OutboundMessage): Promise<{ providerMessageId?: string }>; }

// This safe default records intended messages without sending personal data anywhere.
export class AuditOnlyEmailProvider implements OutboundEmailProvider { async send() { return {}; } }

export async function sendActionableLifeEmails(userId: string, provider: OutboundEmailProvider = new AuditOnlyEmailProvider()) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return [];
  const alerts = await evaluateDrift(userId);
  const review = await getWeeklyReview(userId);
  const messages: OutboundMessage[] = [
    ...alerts.map((alert) => ({ recipient: user.email, subject: alert.title, bodyText: `${alert.explanation}\n\n${alert.recommendedAction}`, triggerFingerprint: `drift:${alert.fingerprint}:${alert.localDate.toISOString()}`, messageType: "drift_alert" })),
    { recipient: user.email, subject: "Your weekly Life OS review", bodyText: `Overall score: ${review.overallScore}/100\nStrongest area: ${review.strongestArea ?? "Unknown"}`, triggerFingerprint: `weekly:${review.weekStart.toISOString()}`, messageType: "weekly_review" }
  ];
  return Promise.all(messages.map(async (message) => {
    const existing = await prisma.emailMessage.findFirst({ where: { userId, direction: "OUTBOUND", triggerFingerprint: message.triggerFingerprint } });
    if (existing) return prisma.emailMessage.create({ data: { userId, direction: "OUTBOUND", messageType: message.messageType, subject: message.subject, bodyText: message.bodyText, recipient: message.recipient, triggerFingerprint: message.triggerFingerprint, suppressed: true } });
    const sent = await provider.send(message);
    return prisma.emailMessage.create({ data: { userId, direction: "OUTBOUND", messageType: message.messageType, subject: message.subject, bodyText: message.bodyText, recipient: message.recipient, provider: "audit-only", providerMessageId: sent.providerMessageId, triggerFingerprint: message.triggerFingerprint } });
  }));
}
