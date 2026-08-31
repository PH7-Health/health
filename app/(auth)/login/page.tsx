import Link from "next/link";
import { LoginForm } from "@/components/auth/login-form";

export default function LoginPage() {
  return <section className="auth-card"><p className="eyebrow">Personal Life OS</p><h1>Return to the essential.</h1><p className="muted">Your private dashboard for health, goals, and the next useful action.</p><LoginForm /><p className="muted">New here? <Link href="/signup">Create a private account</Link>.</p></section>;
}
