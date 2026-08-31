import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Personal Life OS",
  description: "A private system for goals, health signals, and deliberate action."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
