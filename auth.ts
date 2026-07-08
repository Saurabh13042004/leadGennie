import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { findUserByEmail, verifyPassword } from "@/lib/users";

export const { handlers, signIn, signOut, auth } = NextAuth({
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      authorize: async (credentials) => {
        const email = credentials?.email as string | undefined;
        const password = credentials?.password as string | undefined;
        if (!email || !password) return null;

        const user = findUserByEmail(email);
        if (!user) return null;

        const valid = await verifyPassword(user, password);
        if (!valid) return null;

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          company: user.company,
        };
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.company = (user as { company?: string }).company;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.company = token.company as string | undefined;
      }
      return session;
    },
  },
});
