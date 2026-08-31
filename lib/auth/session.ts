import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";

import { authOptions } from "@/auth";

export async function requireUser() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");
  return { id: session.user.id, email: session.user.email ?? "" };
}
