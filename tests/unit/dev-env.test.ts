import { describe, expect, it } from "vitest";
import { checkDevEnv } from "../../scripts/lib/dev-env.mjs";

const TOKEN = "tok-SUPER-SECRET-123";
const SECRET = "sig-SUPER-SECRET-456";

const app = () => ({
  DATABASE_URL: "postgres://u:p@h/db", AUTH_SECRET: "a", CRON_SECRET: "c", CREDENTIALS_ENCRYPTION_KEY: "k",
  INTELLIGENCE_URL: "http://localhost:8000", INTELLIGENCE_SERVICE_TOKEN: TOKEN, INTELLIGENCE_SIGNING_SECRET: SECRET,
});
const engine = () => ({
  INTELLIGENCE_SERVICE_TOKEN: TOKEN, INTELLIGENCE_SIGNING_SECRET: SECRET, OPENAI_API_KEY: "sk-x",
  SEARCH_PROVIDER: "tavily", TAVILY_API_KEY: "tvly-x", NEWS_FALLBACK: "gdelt", ENGINE_FAKE_MODE: "0", INTEL_DATABASE_URL: "postgres://engine",
});

describe("checkDevEnv", () => {
  it("passes a complete, consistent setup with no warnings", () => {
    expect(checkDevEnv(app(), engine())).toEqual({ errors: [], warnings: [] });
  });

  it("flags the engine's empty secrets and the app's missing INTELLIGENCE_* (the exact state we started from)", () => {
    const a = { ...app() } as Record<string, string | undefined>;
    delete a.INTELLIGENCE_URL; delete a.INTELLIGENCE_SERVICE_TOKEN; delete a.INTELLIGENCE_SIGNING_SECRET;
    const r = checkDevEnv(a, { ...engine(), INTELLIGENCE_SERVICE_TOKEN: "", INTELLIGENCE_SIGNING_SECRET: "" });
    expect(r.errors.join("\n")).toMatch(/\.env\.local: INTELLIGENCE_URL is not set/);
    expect(r.errors.join("\n")).toMatch(/INTELLIGENCE_SERVICE_TOKEN is empty — the engine refuses to start/);
  });

  it("flags secrets that differ between app and engine, without echoing either value", () => {
    const r = checkDevEnv(app(), { ...engine(), INTELLIGENCE_SIGNING_SECRET: "a-different-secret-789" });
    const text = r.errors.join("\n");
    expect(text).toMatch(/INTELLIGENCE_SIGNING_SECRET differs between \.env\.local and services\/intelligence\/\.env/);
    for (const secret of [TOKEN, SECRET, "a-different-secret-789"]) expect(text).not.toContain(secret);
  });

  it("no message of any kind ever contains a secret value", () => {
    const r = checkDevEnv({ ...app(), DATABASE_URL: "" }, { ...engine(), SEARCH_PROVIDER: "tavily", TAVILY_API_KEY: "", ENGINE_FAKE_MODE: "1", INTEL_DATABASE_URL: "" });
    const all = [...r.errors, ...r.warnings].join("\n");
    for (const secret of [TOKEN, SECRET, "sk-x", "postgres://u:p@h/db"]) expect(all).not.toContain(secret);
  });

  it("requires a key for the chosen search provider", () => {
    expect(checkDevEnv(app(), { ...engine(), TAVILY_API_KEY: "" }).errors.join()).toMatch(/SEARCH_PROVIDER=tavily but TAVILY_API_KEY is empty/);
    expect(checkDevEnv(app(), { ...engine(), SEARCH_PROVIDER: "brave" }).errors.join()).toMatch(/BRAVE_API_KEY is empty/);
  });

  it("warns (does not fail) about fake mode, search off, and the in-memory store", () => {
    const r = checkDevEnv(app(), { ...engine(), ENGINE_FAKE_MODE: "1", SEARCH_PROVIDER: "none", INTEL_DATABASE_URL: "" });
    expect(r.errors).toEqual([]);
    const w = r.warnings.join("\n");
    expect(w).toMatch(/ENGINE_FAKE_MODE is on/);
    expect(w).toMatch(/SEARCH_PROVIDER=none/);
    expect(w).toMatch(/keeps runs in memory/);
  });

  it("requires an OpenAI key for the engine and rejects a malformed INTELLIGENCE_URL", () => {
    expect(checkDevEnv(app(), { ...engine(), OPENAI_API_KEY: "" }).errors.join()).toMatch(/OPENAI_API_KEY is not set/);
    expect(checkDevEnv({ ...app(), INTELLIGENCE_URL: "not a url" }, engine()).errors.join()).toMatch(/not a valid URL/);
  });

  it("warns when INTELLIGENCE_URL points at another machine (a local engine would go unused)", () => {
    expect(checkDevEnv({ ...app(), INTELLIGENCE_URL: "https://engine.example.com" }, engine()).warnings.join()).toMatch(/not this machine/);
  });
});
