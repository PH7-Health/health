"use client";

import Link from "next/link";
import { signOut } from "next-auth/react";
import { usePathname } from "next/navigation";

const links = [["/today", "Today"], ["/check-in", "Check-in"], ["/goals", "Goals"], ["/dashboard", "Dashboard"], ["/weekly-review", "Weekly review"]] as const;

export function AppShell({ children, email }: { children: React.ReactNode; email: string }) {
  const pathname = usePathname();
  return <div className="shell"><aside><div><p className="brand">Personal Life OS</p><p className="side-copy">A private operating rhythm for the things that matter.</p></div><nav>{links.map(([href, label]) => <Link key={href} href={href} className={pathname === href ? "active" : ""}>{label}</Link>)}</nav><div className="account"><span>{email}</span><button className="quiet" onClick={() => signOut({ callbackUrl: "/login" })}>Sign out</button></div></aside><main><header><div><p className="eyebrow">Private executive dashboard</p><h1>Measure less. Notice more.</h1></div><span className="status-dot">Private</span></header><div className="content">{children}</div></main></div>;
}
