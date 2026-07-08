import { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      company?: string;
    } & DefaultSession["user"];
  }

  interface User {
    company?: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    company?: string;
  }
}
