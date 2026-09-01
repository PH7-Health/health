import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/session";
import { submitAlignmentTurn } from "@/lib/intelligence/alignment";

export async function POST(request: Request) { try { const user = await requireUser(); const body = await request.json() as { sessionId?: string; content?: string; clientTurnId?: string }; if (!body.sessionId || !body.content || !body.clientTurnId) throw new Error("A session, answer, and turn identity are required."); return NextResponse.json(await submitAlignmentTurn(user.id, body.sessionId, body.content, body.clientTurnId)); } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Alignment could not continue safely." }, { status: 400 }); } }
