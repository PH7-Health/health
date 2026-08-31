import Link from "next/link";
import { signupAction } from "./actions";

export default async function SignupPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return <section className="auth-card"><p className="eyebrow">Private by default</p><h1>Set up your Life OS.</h1><p className="muted">This starts a personal baseline you can edit at any time.</p>{error ? <p className="error">{error}</p> : null}<form action={signupAction} className="form-stack"><label>Name<input name="name" autoComplete="name" /></label><label>Email<input name="email" type="email" required autoComplete="email" /></label><label>Password<input name="password" type="password" minLength={8} required autoComplete="new-password" /></label><button>Create account</button></form><p className="muted">Already have an account? <Link href="/login">Sign in</Link>.</p></section>;
}
