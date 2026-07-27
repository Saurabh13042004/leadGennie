import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { findUserByEmail, verifyPassword } from "@/lib/users";
import { getPrimaryWorkspace } from "@/lib/workspace";

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

        const user = await findUserByEmail(email);
        if (!user) return null;

        const valid = await verifyPassword(user, password);
        if (!valid) return null;

        const workspace = await getPrimaryWorkspace(Number(user.id));
        if (!workspace) return null;

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          company: user.company,
          workspaceId: workspace.id,
          workspaceName: workspace.name,
          role: workspace.role,
        };
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        const u = user as {
          company?: string;
          workspaceId: number;
          workspaceName: string;
          role: string;
        };
        token.company = u.company;
        token.workspaceId = u.workspaceId;
        token.workspaceName = u.workspaceName;
        token.role = u.role;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub as string;
        session.user.company = token.company as string | undefined;
        session.user.workspaceId = token.workspaceId as number;
        session.user.workspaceName = token.workspaceName as string;
        session.user.role = token.role as string;
      }
      return session;
    },
  },
});
