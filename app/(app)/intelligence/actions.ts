"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { createPathwayProposal, recalculatePathway, resolveProposal } from "@/lib/intelligence/service";

const paths = ["/intelligence", "/goals", "/today", "/dashboard"];
const refresh = () => paths.forEach((path) => revalidatePath(path));
const number = (value: FormDataEntryValue | null) => value === null || value === "" ? undefined : Number(value);

export async function generatePathwayAction(formData: FormData) {
  const user = await requireUser();
  try { await createPathwayProposal(user.id, { objectiveId: String(formData.get("objectiveId")), currentDescription: String(formData.get("currentDescription") ?? ""), desiredDescription: String(formData.get("desiredDescription") ?? ""), constraints: String(formData.get("constraints") ?? ""), preferences: String(formData.get("preferences") ?? ""), baselineValue: number(formData.get("baselineValue")), targetValue: number(formData.get("targetValue")), unit: String(formData.get("unit") ?? ""), direction: String(formData.get("direction") ?? "INCREASE"), desiredDate: String(formData.get("desiredDate") ?? "") }); } catch (error) { redirect(`/intelligence?error=${encodeURIComponent(error instanceof Error ? error.message : "Pathway generation failed safely. Please retry.")}`); }
  refresh();
}

export async function resolveProposalAction(formData: FormData) { const user = await requireUser(); await resolveProposal(user.id, String(formData.get("proposalId")), String(formData.get("decision")) === "accept"); refresh(); }
export async function recalculatePathwayAction(formData: FormData) { const user = await requireUser(); await recalculatePathway(user.id, String(formData.get("pathwayId"))); refresh(); }
