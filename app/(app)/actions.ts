"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/lib/auth/session";
import { addTask, saveCheckIn, saveWeeklyReflection, setCompletion } from "@/lib/life-os/service";

const id = z.string().cuid();
const paths = ["/today", "/dashboard", "/goals", "/weekly-review"];
const refresh = () => paths.forEach((path) => revalidatePath(path));

export async function completeAction(type: "task" | "habit" | "supplement", targetId: string) { const user = await requireUser(); const parsed = id.safeParse(targetId); if (!parsed.success) return; await setCompletion(user.id, type, parsed.data); refresh(); }
export async function addTaskAction(formData: FormData) { const user = await requireUser(); const title = z.string().trim().min(1).max(180).safeParse(formData.get("title")); const priority = z.enum(["MOST_IMPORTANT", "CRITICAL", "SECONDARY", "OPTIONAL"]).safeParse(formData.get("priority")); if (!title.success || !priority.success) return; await addTask(user.id, title.data, priority.data); refresh(); }
export async function saveCheckInAction(formData: FormData) { const user = await requireUser(); await saveCheckIn(user.id, Object.fromEntries(formData)); refresh(); redirect("/today?checkedIn=1"); }
export async function saveReflectionAction(formData: FormData) { const user = await requireUser(); await saveWeeklyReflection(user.id, z.string().trim().max(5000).catch("").parse(formData.get("reflection"))); refresh(); }
