"use client";
import Link from "next/link";
import { signOut } from "next-auth/react";
import { usePathname } from "next/navigation";
const primary = [
  ["/alignment", "Alignment"],
  ["/today", "Today"],
  ["/check-in", "Check-in"],
  ["/dashboard", "Progress"],
  ["/weekly-review", "Review"],
] as const;
const titles: Record<string, string> = {
  "/alignment": "Alignment",
  "/today": "Today",
  "/check-in": "Check-in",
  "/dashboard": "Progress",
  "/weekly-review": "Weekly review",
  "/settings": "Advanced configuration",
  "/goals": "Objectives",
  "/intelligence": "Strategy proposals",
};
export function AppShell({
  children,
  email,
}: {
  children: React.ReactNode;
  email: string;
}) {
  const pathname = usePathname();
  const area = pathname.startsWith("/alignment/");
  return (
    <div className="shell">
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <aside className="app-nav">
        <Link className="wordmark" href="/today">
          LIFE OS
        </Link>
        <nav aria-label="Primary navigation">
          {primary.map(([href, label]) => {
            const selected =
              pathname === href || (href === "/alignment" && area);
            return (
              <Link
                key={href}
                href={href}
                aria-current={selected ? "page" : undefined}
                className={`${selected ? "active " : ""}${href === "/alignment" ? "alignment-link" : ""}`}
              >
                {label}
              </Link>
            );
          })}
        </nav>
        <div className="shell-tools">
          <Link href="/settings">Advanced</Link>
          <button
            className="quiet"
            onClick={() => signOut({ callbackUrl: "/login" })}
          >
            Sign out
          </button>
        </div>
      </aside>
      <main id="main-content">
        <header className="page-orientation">
          <div>
            {area ? (
              <Link href="/alignment" className="text-link">
                ← All life areas
              </Link>
            ) : (
              <p className="eyebrow">
                Life OS /{" "}
                {pathname === "/today"
                  ? "Act"
                  : pathname === "/check-in"
                    ? "Observe"
                    : pathname === "/weekly-review"
                      ? "Reflect"
                      : "Your direction"}
              </p>
            )}
            <h1>{area ? "Your strategy" : (titles[pathname] ?? "Life OS")}</h1>
          </div>
          <span className="private-context">Private to you</span>
        </header>
        <div className="content">{children}</div>
        <footer className="app-footer">
          <Link href="/settings">Advanced configuration</Link>
          <span>{email}</span>
        </footer>
      </main>
    </div>
  );
}
