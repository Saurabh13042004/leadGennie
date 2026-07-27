import { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      company?: string;
      workspaceId: number;
      workspaceName: string;
      role: string;
    } & DefaultSession["user"];
  }

  interface User {
    company?: string;
    workspaceId: number;
    workspaceName: string;
    role: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    company?: string;
    workspaceId?: number;
    workspaceName?: string;
    role?: string;
  }
}
