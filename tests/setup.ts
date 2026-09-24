import { vi } from "vitest";

// Hard guarantee: no test can talk to a real database.
process.env.DATABASE_URL = "postgres://never-connects.invalid/test";
vi.mock("@neondatabase/serverless", () => ({
  neon: () => {
    throw new Error("Tests must not use the real Neon driver — use tests/helpers/test-db");
  },
}));

// Every app module gets the in-process test database instead of Neon.
vi.mock("@/lib/db/client", async () => {
  const { sql } = await import("./helpers/test-db");
  return { sql };
});

// Server actions call revalidatePath; outside a Next request it would throw.
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
  unstable_cache: <T>(fn: T) => fn,
}));

process.env.CREDENTIALS_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString("base64");
process.env.AUTH_SECRET = "test-secret";
