import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/session";
import { getAlignmentSession, resumeAlignmentSession } from "@/lib/intelligence/alignment";

export async function GET(request: Request) { try { const user = await requireUser(); const area = new URL(request.url).searchParams.get("lifeAreaId"); if (!area) throw new Error("Life area is required."); const session = await resumeAlignmentSession(user.id, area); return NextResponse.json(await getAlignmentSession(user.id, session.id)); } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to open Alignment." }, { status: 400 }); } }
