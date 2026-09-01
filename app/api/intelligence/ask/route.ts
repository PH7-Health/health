import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/session";
import { askLifeOs } from "@/lib/intelligence/coaching";
export async function POST(request: Request) { try { const user = await requireUser(); const body = await request.json() as { question?: string; pathwayId?: string; lifeAreaId?: string; followUps?: Array<{ question: string; answer: string }> }; const answer = await askLifeOs(user.id, body.question ?? "", { pathwayId: body.pathwayId, lifeAreaId: body.lifeAreaId }, body.followUps); return NextResponse.json(answer); } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Life OS could not answer safely." }, { status: 400 }); } }
