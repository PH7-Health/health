import { prisma } from "../lib/db/prisma";
import { hashPassword } from "../lib/auth/password";
import { ensureLifeOsSeed } from "../lib/life-os/service";

async function main() {
  const email = process.env.SEED_USER_EMAIL?.toLowerCase();
  const password = process.env.SEED_USER_PASSWORD;
  if (!email || !password) { console.log("No seed user requested. Set SEED_USER_EMAIL and SEED_USER_PASSWORD to create a local test account."); return; }
  const user = await prisma.user.upsert({ where: { email }, update: {}, create: { email, passwordHash: await hashPassword(password), name: "Local test user" } });
  await ensureLifeOsSeed(user.id);
  console.log(`Seeded Life OS configuration for ${email}.`);
}

main().finally(() => prisma.$disconnect());
