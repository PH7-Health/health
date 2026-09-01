"use server";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/session";
import { generateWeeklyCoach } from "@/lib/intelligence/coaching";
export async function generateWeeklyCoachAction(){const user=await requireUser();await generateWeeklyCoach(user.id);revalidatePath("/weekly-review");}
