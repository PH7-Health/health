"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { hashPassword } from "@/lib/auth/password";
import { prisma } from "@/lib/db/prisma";
import { ensureLifeOsSeed } from "@/lib/life-os/service";

const signupSchema = z.object({ name: z.string().trim().max(80).optional(), email: z.string().email(), password: z.string().min(8).max(128) });

export async function signupAction(formData: FormData) {
  const parsed = signupSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect("/signup?error=Please%20use%20a%20valid%20email%20and%208%2B%20character%20password.");
  const email = parsed.data.email.toLowerCase();
  if (await prisma.user.findUnique({ where: { email } })) redirect("/signup?error=That%20email%20already%20has%20an%20account.");
  const user = await prisma.user.create({ data: { email, name: parsed.data.name || null, passwordHash: await hashPassword(parsed.data.password) } });
  await ensureLifeOsSeed(user.id);
  redirect("/login?created=1");
}
