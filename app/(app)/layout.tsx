import { AppShell } from "@/components/app-shell";
import { requireUser } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function LifeLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  return <AppShell email={user.email}>{children}</AppShell>;
}
