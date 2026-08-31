import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { sendActionableLifeEmails } from "@/lib/life-os/notifications";

export async function GET(request: NextRequest) {
  if (!process.env.CRON_SECRET || request.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const users = await prisma.user.findMany({ select: { id: true } });
  const results = await Promise.all(users.map(async (user) => ({ userId: user.id, messages: (await sendActionableLifeEmails(user.id)).length })));
  return NextResponse.json({ ok: true, results });
}
