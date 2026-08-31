import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { z } from "zod";

import { prisma } from "@/lib/db/prisma";
import { verifyPassword } from "@/lib/auth/password";

const credentials = z.object({ email: z.string().email(), password: z.string().min(8) });

export const authOptions: NextAuthOptions = {
  secret: process.env.NEXTAUTH_SECRET,
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [CredentialsProvider({
    name: "Email and password",
    credentials: { email: { type: "email" }, password: { type: "password" } },
    async authorize(input) {
      const parsed = credentials.safeParse(input);
      if (!parsed.success) return null;
      const user = await prisma.user.findUnique({ where: { email: parsed.data.email.toLowerCase() } });
      if (!user || !(await verifyPassword(parsed.data.password, user.passwordHash))) return null;
      return { id: user.id, email: user.email, name: user.name };
    }
  })],
  callbacks: {
    jwt: ({ token, user }) => { if (user) token.sub = user.id; return token; },
    session: ({ session, token }) => { if (session.user && token.sub) session.user.id = token.sub; return session; }
  }
};
