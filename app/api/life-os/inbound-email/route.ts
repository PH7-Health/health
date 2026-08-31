import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { persistInboundEmail } from "@/lib/life-os/service";

const payload = z.object({ userEmail: z.string().email(), sender: z.string().optional(), subject: z.string().min(1).default("Life OS update"), bodyText: z.string().min(1), provider: z.string().optional(), providerMessageId: z.string().optional() });

export async function POST(request: NextRequest) {
  if (!process.env.LIFE_OS_WEBHOOK_SECRET || request.headers.get("x-life-os-signature") !== process.env.LIFE_OS_WEBHOOK_SECRET) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = payload.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "Invalid payload", issues: parsed.error.flatten() }, { status: 400 });
  const user = await prisma.user.findUnique({ where: { email: parsed.data.userEmail.toLowerCase() } });
  if (!user) return NextResponse.json({ error: "No matching user" }, { status: 404 });
  const result = await persistInboundEmail(user.id, parsed.data);
  return NextResponse.json({ messageId: result.message.id, parsedCount: result.parsedCount, confirmationRequired: result.parsedCount });
}
