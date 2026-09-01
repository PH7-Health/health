import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/session";
import { correctAlignmentAssertion } from "@/lib/intelligence/alignment";

export async function POST(request: Request) { try { const user = await requireUser(); const body = await request.json() as { sessionId?: string; assertionId?: string; intent?: string }; if (!body.sessionId || !body.assertionId || !body.intent) throw new Error("A correction is required."); await correctAlignmentAssertion(user.id, body.sessionId, body.assertionId, body.intent); return NextResponse.json({ ok: true }); } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to save correction." }, { status: 400 }); } }
