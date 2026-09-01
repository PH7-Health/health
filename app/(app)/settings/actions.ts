"use server";

import { TaskPriority } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";

const paths = ["/settings", "/today", "/check-in", "/dashboard", "/goals", "/weekly-review"];
const refresh = () => paths.forEach((path) => revalidatePath(path));
const text = (data: FormData, key: string) => String(data.get(key) ?? "").trim();
const number = (data: FormData, key: string) => { const value = text(data, key); return value === "" ? null : Number(value); };
const flag = (data: FormData, key: string) => data.get(key) === "on";
const days = (data: FormData) => data.getAll("days").map(Number).filter((day) => Number.isInteger(day) && day >= 0 && day <= 6);
const date = (data: FormData, key: string) => { const value = text(data, key); return value ? new Date(`${value}T12:00:00.000Z`) : null; };

export async function saveArea(data: FormData) {
  const user = await requireUser(); const id = text(data, "id"); const name = text(data, "name"); if (!name) return;
  const values = { name, description: text(data, "description") || null, weight: Math.max(0, Math.min(100, Math.round(number(data, "weight") ?? 0))), active: flag(data, "active") };
  if (id) await prisma.lifeArea.updateMany({ where: { id, userId: user.id }, data: values });
  else await prisma.lifeArea.create({ data: { userId: user.id, key: `${name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")}-${Date.now().toString(36)}`, sortOrder: await prisma.lifeArea.count({ where: { userId: user.id } }), ...values } });
  refresh();
}

async function moveArea(data: FormData, direction: "up" | "down") {
  const user = await requireUser(); const id = text(data, "id"); const current = await prisma.lifeArea.findFirst({ where: { id, userId: user.id } }); if (!current) return;
  const neighbor = await prisma.lifeArea.findFirst({ where: { userId: user.id, sortOrder: direction === "up" ? { lt: current.sortOrder } : { gt: current.sortOrder } }, orderBy: { sortOrder: direction === "up" ? "desc" : "asc" } });
  if (neighbor) await prisma.$transaction([prisma.lifeArea.update({ where: { id: current.id }, data: { sortOrder: neighbor.sortOrder } }), prisma.lifeArea.update({ where: { id: neighbor.id }, data: { sortOrder: current.sortOrder } })]);
  refresh();
}

export async function moveAreaUp(data: FormData) { await moveArea(data, "up"); }
export async function moveAreaDown(data: FormData) { await moveArea(data, "down"); }

export async function removeArea(data: FormData) {
  const user = await requireUser(); const id = text(data, "id"); const area = await prisma.lifeArea.findFirst({ where: { id, userId: user.id }, include: { _count: { select: { objectives: true, habits: true, tasks: true } } } }); if (!area) return;
  if (area._count.objectives || area._count.habits || area._count.tasks) await prisma.lifeArea.update({ where: { id }, data: { active: false } }); else await prisma.lifeArea.delete({ where: { id } });
  refresh();
}

export async function saveObjective(data: FormData) {
  const user = await requireUser(); const id = text(data, "id"); const title = text(data, "title"); const lifeAreaId = text(data, "lifeAreaId"); if (!title || !lifeAreaId) return;
  const values = { title, description: text(data, "description") || null, lifeAreaId, priority: Math.max(1, Math.min(5, Math.round(number(data, "priority") ?? 3))), dueDate: date(data, "dueDate"), active: flag(data, "active") };
  if (id) await prisma.objective.updateMany({ where: { id, userId: user.id }, data: values }); else await prisma.objective.create({ data: { userId: user.id, ...values } }); refresh();
}

export async function saveKeyResult(data: FormData) {
  const user = await requireUser(); const id = text(data, "id"); const title = text(data, "title"); const objectiveId = text(data, "objectiveId"); if (!title || !objectiveId) return;
  const metricDefinitionId = text(data, "metricDefinitionId") || null;
  const values = { title, description: text(data, "description") || null, objectiveId, metricDefinitionId, baseline: number(data, "baseline"), target: number(data, "target"), currentValue: number(data, "currentValue"), unit: text(data, "unit") || null, targetDirection: text(data, "targetDirection") || "INCREASE", currentValueSource: text(data, "currentValueSource") || "manual", dueDate: date(data, "dueDate"), qualitative: flag(data, "qualitative"), active: flag(data, "active") };
  if (id) await prisma.keyResult.updateMany({ where: { id, userId: user.id }, data: values }); else await prisma.keyResult.create({ data: { userId: user.id, ...values } }); refresh();
}

export async function saveHabit(data: FormData) {
  const user = await requireUser(); const id = text(data, "id"); const name = text(data, "name"); const lifeAreaId = text(data, "lifeAreaId"); if (!name || !lifeAreaId) return;
  const values = { name, lifeAreaId, objectiveId: text(data, "objectiveId") || null, targetCount: Math.max(1, Math.round(number(data, "targetCount") ?? 1)), targetPeriod: text(data, "targetPeriod") || "day", frequency: text(data, "frequency") || "DAILY", scoreWeight: Math.max(0, number(data, "scoreWeight") ?? 1), showToday: flag(data, "showToday"), affectsScore: flag(data, "affectsScore"), participatesInDrift: flag(data, "participatesInDrift"), notes: text(data, "notes") || null, active: flag(data, "active") };
  const schedule = { daysOfWeek: days(data) };
  if (id) { await prisma.habit.updateMany({ where: { id, userId: user.id }, data: values }); await prisma.habitSchedule.deleteMany({ where: { habitId: id } }); await prisma.habitSchedule.create({ data: { habitId: id, ...schedule } }); }
  else await prisma.habit.create({ data: { userId: user.id, key: `${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${Date.now().toString(36)}`, ...values, schedules: { create: schedule } } }); refresh();
}

export async function saveMetric(data: FormData) {
  const user = await requireUser(); const id = text(data, "id"); const name = text(data, "name"); if (!name) return;
  const values = { name, description: text(data, "description") || null, category: text(data, "category") || "custom", unit: text(data, "unit") || null, valueType: (text(data, "valueType") || "NUMBER") as never, defaultTarget: number(data, "defaultTarget"), targetMin: number(data, "targetMin"), targetMax: number(data, "targetMax"), targetDirection: text(data, "targetDirection") || "NONE", frequency: text(data, "frequency") || "DAILY", decimalPrecision: Math.max(0, Math.min(4, Math.round(number(data, "decimalPrecision") ?? 0))), showInCheckIn: flag(data, "showInCheckIn"), showInDashboard: flag(data, "showInDashboard"), useInDrift: flag(data, "useInDrift"), useInScore: flag(data, "useInScore"), important: flag(data, "important"), active: flag(data, "active") };
  if (id) await prisma.metricDefinition.updateMany({ where: { id, userId: user.id }, data: values }); else await prisma.metricDefinition.create({ data: { userId: user.id, key: `${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${Date.now().toString(36)}`, ...values } }); refresh();
}

export async function saveSupplement(data: FormData) {
  const user = await requireUser(); const id = text(data, "id"); const name = text(data, "name"); if (!name) return;
  const values = { name, intendedDose: number(data, "intendedDose"), doseUnit: text(data, "doseUnit") || null, normalTime: text(data, "normalTime") || null, frequency: text(data, "frequency") || "DAILY", startDate: date(data, "startDate"), endDate: date(data, "endDate"), notes: text(data, "notes") || null, active: flag(data, "active") };
  const schedule = { daysOfWeek: days(data) };
  if (id) { await prisma.supplement.updateMany({ where: { id, userId: user.id }, data: values }); await prisma.supplementSchedule.deleteMany({ where: { supplementId: id } }); await prisma.supplementSchedule.create({ data: { supplementId: id, ...schedule } }); }
  else await prisma.supplement.create({ data: { userId: user.id, ...values, schedules: { create: schedule } } }); refresh();
}

export async function saveRecurringAction(data: FormData) {
  const user = await requireUser(); const id = text(data, "id"); const title = text(data, "title"); if (!title) return;
  const values = { title, lifeAreaId: text(data, "lifeAreaId") || null, objectiveId: text(data, "objectiveId") || null, priority: (text(data, "priority") || "SECONDARY") as TaskPriority, showToday: flag(data, "showToday"), scoreRelevant: flag(data, "scoreRelevant"), targetFrequency: Math.max(1, Math.round(number(data, "targetFrequency") ?? 1)), active: flag(data, "active") };
  const recurrence = { frequency: text(data, "frequency") || "WEEKLY", daysOfWeek: days(data) };
  if (id) { await prisma.task.updateMany({ where: { id, userId: user.id }, data: values }); await prisma.recurrenceRule.upsert({ where: { taskId: id }, update: recurrence, create: { taskId: id, ...recurrence } }); }
  else await prisma.task.create({ data: { userId: user.id, ...values, recurrenceRule: { create: recurrence } } }); refresh();
}

export async function saveRule(data: FormData) {
  const user = await requireUser(); const id = text(data, "id"); const name = text(data, "name"); if (!id || !name) return;
  const config = { threshold: Math.max(0, Math.min(100, number(data, "threshold") ?? 60)), days: Math.max(1, Math.min(30, Math.round(number(data, "days") ?? 3))), recommendedAction: text(data, "recommendedAction") || "Choose one health action and one essential task, then reduce optional commitments." };
  await prisma.alertRule.updateMany({ where: { id, userId: user.id }, data: { name, active: flag(data, "active"), config } }); refresh();
}

export async function saveNotification(data: FormData) {
  const user = await requireUser(); const id = text(data, "id"); if (!id) return;
  await prisma.notificationPreference.updateMany({ where: { id, userId: user.id }, data: { enabled: flag(data, "enabled"), minSeverity: (text(data, "minSeverity") || "WATCH") as never } }); refresh();
}
