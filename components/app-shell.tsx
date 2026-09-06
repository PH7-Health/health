"use client";

import Link from "next/link";
import { signOut } from "next-auth/react";
import { usePathname } from "next/navigation";

const primary = [["/alignment", "Align"], ["/today", "Today"], ["/check-in", "Check-in"], ["/dashboard", "Dashboard"], ["/weekly-review", "Review"]] as const;
const titles: Record<string, string> = { "/alignment": "Alignment", "/today": "Today", "/check-in": "Check-in", "/dashboard": "Dashboard", "/weekly-review": "Weekly review", "/settings": "Advanced configuration", "/goals": "Goals", "/intelligence": "Pathways" };

export function AppShell({ children, email }: { children: React.ReactNode; email: string }) {
  const pathname = usePathname(); const title = titles[pathname] ?? "Life OS";
  return <div className="shell"><aside className="app-nav"><Link className="wordmark" href="/alignment">LIFE OS</Link><nav aria-label="Primary navigation">{primary.map(([href, label]) => <Link key={href} href={href} className={`${pathname === href || (href === "/alignment" && pathname.startsWith("/alignment/")) ? "active " : ""}${href === "/alignment" ? "alignment-link" : ""}`}><span>{label}</span></Link>)}</nav><div className="shell-tools"><Link href="/settings">Advanced</Link><button className="quiet" onClick={() => signOut({ callbackUrl: "/login" })}>Sign out</button></div><div className="account"><span>{email}</span></div></aside><main><header className="page-orientation"><div><p className="eyebrow">Private life operating system</p><h1>{title}</h1></div><div className="operating-context" aria-label="Life OS operating loop"><span>Align</span><i>→</i><span>Act</span><i>→</i><span>Observe</span><i>→</i><span>Review</span><i>→</i><span>Adapt</span></div></header><div className="content">{children}</div></main></div>;
}
