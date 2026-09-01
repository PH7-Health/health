"use client";

import Link from "next/link";
import { signOut } from "next-auth/react";
import { usePathname } from "next/navigation";

const links = [["/today", "Today"], ["/check-in", "Check-in"], ["/intelligence", "Pathways"], ["/goals", "Goals"], ["/dashboard", "Dashboard"], ["/weekly-review", "Weekly review"], ["/settings", "Settings"]] as const;

export function AppShell({ children, email }: { children: React.ReactNode; email: string }) {
  const pathname = usePathname();
  return <div className="shell"><aside><div className="wordmark">LIFE OS</div><nav>{links.map(([href, label]) => <Link key={href} href={href} className={pathname === href ? "active" : ""}>{label}</Link>)}</nav><div className="account"><span>{email}</span><button className="quiet" onClick={() => signOut({ callbackUrl: "/login" })}>Sign out</button></div></aside><main><header><div><p className="eyebrow">Private operating system</p><h1>{pathname === "/today" ? "Today" : links.find(([href]) => href === pathname)?.[1] ?? "Life OS"}</h1></div><span className="status-dot">Private</span></header><div className="content">{children}</div></main></div>;
}
