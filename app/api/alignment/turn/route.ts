import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/session";
import { getAlignmentSession, submitAlignmentTurn } from "@/lib/intelligence/alignment";

export async function POST(request: Request) { let sessionId: string | undefined; try { const user = await requireUser(); const body = await request.json() as { sessionId?: string; content?: string; clientTurnId?: string }; sessionId = body.sessionId; if (!body.sessionId || !body.content || !body.clientTurnId) throw new Error("A session, answer, and turn identity are required."); return NextResponse.json(await submitAlignmentTurn(user.id, body.sessionId, body.content, body.clientTurnId)); } catch (error) { const user = await requireUser().catch(() => null); const session = user && sessionId ? await getAlignmentSession(user.id, sessionId) : null; return NextResponse.json({ error: error instanceof Error ? error.message : "Alignment could not continue safely.", session }, { status: 400 }); } }
