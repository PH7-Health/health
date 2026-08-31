"use client";

import { signIn } from "next-auth/react";
import { useState } from "react";

export function LoginForm() {
  const [error, setError] = useState("");
  return <form className="form-stack" onSubmit={async (event) => { event.preventDefault(); const data = new FormData(event.currentTarget); const result = await signIn("credentials", { email: data.get("email"), password: data.get("password"), redirect: false }); if (result?.error) setError("That email and password do not match."); else window.location.assign("/today"); }}><label>Email<input name="email" type="email" required autoComplete="email" /></label><label>Password<input name="password" type="password" required autoComplete="current-password" /></label>{error ? <p className="error">{error}</p> : null}<button type="submit">Sign in</button></form>;
}
