import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Architecture gates for the mailbox migration, enforced on the source itself:
 *  1. campaign / sending / agent code never branches on a provider NAME (provider details stay in adapters + lib/domain/mailboxes);
 *  2. OAuth credentials are only ever touched by the modules that own them — never by UI, actions or pages.
 */
const ROOT = process.cwd();

function* walk(dir: string): Generator<string> {
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name.startsWith(".")) continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) yield* walk(full);
    else if (/\.(ts|tsx)$/.test(name)) yield full;
  }
}
const rel = (p: string) => relative(ROOT, p).split(sep).join("/");
const filesIn = (...dirs: string[]) => dirs.flatMap((d) => [...walk(join(ROOT, d))]);

describe("provider boundary", () => {
  const COMPARES_A_PROVIDER = /(?:[!=]==?\s*["'](?:gmail|microsoft|resend)["'])|(?:["'](?:gmail|microsoft|resend)["']\s*[!=]==?)|case\s+["'](?:gmail|microsoft|resend)["']\s*:/;

  it("campaign, sending, agent, job and action code never compare a provider by name", () => {
    const offenders = filesIn("lib/domain/sending", "lib/domain/campaigns", "lib/agent", "lib/jobs", "lib/actions", "app/dashboard/campaigns", "components/campaigns")
      .flatMap((f) => readFileSync(f, "utf-8").split("\n").map((line, i) => ({ f: rel(f), i: i + 1, line })))
      .filter(({ line }) => !line.trim().startsWith("//") && !line.trim().startsWith("*") && COMPARES_A_PROVIDER.test(line))
      .map(({ f, i, line }) => `${f}:${i}  ${line.trim().slice(0, 100)}`);
    expect(offenders).toEqual([]);
  });

  it("the gate itself catches what it should", () => {
    for (const bad of ['if (provider === "gmail") {', "if (m.provider !== 'resend')", 'case "microsoft":', '"gmail" === p']) expect(COMPARES_A_PROVIDER.test(bad), bad).toBe(true);
    for (const ok of ['const p = "gmail";', "provider: 'resend',", "isOAuthProvider(m.provider)"]) expect(COMPARES_A_PROVIDER.test(ok), ok).toBe(false);
  });

  it("adapters never import campaign or sending code (dependency direction: domain → adapters, not back)", () => {
    const offenders = filesIn("lib/email")
      .filter((f) => /from ["']@\/lib\/domain\/(sending|campaigns)/.test(readFileSync(f, "utf-8")))
      .map(rel);
    expect(offenders).toEqual([]);
  });
});

describe("credential handling", () => {
  const CREDENTIAL_COLUMNS = /access_token_enc|refresh_token_enc|accessTokenEnc|refreshTokenEnc/;
  const OWNERS = new Set([
    "lib/domain/mailboxes/repository.ts", // the only SQL that reads or writes the columns
    "lib/domain/mailboxes/token-source.ts", // decrypts, refreshes, re-encrypts
    "lib/domain/mailboxes/connect-service.ts", // encrypts what the provider just issued
    "lib/domain/mailboxes/service.ts", // reads the refresh token to revoke it on disconnect
  ]);

  it("only the modules that own credentials touch the credential columns", () => {
    const offenders = filesIn("lib", "app", "components").filter((f) => CREDENTIAL_COLUMNS.test(readFileSync(f, "utf-8"))).map(rel).filter((f) => !OWNERS.has(f));
    expect(offenders).toEqual([]);
  });

  it("no query used by the UI or campaign code selects credentials (`select *` on mailboxes would leak ciphertext)", () => {
    const offenders = filesIn("lib", "app").flatMap((f) => {
      const src = readFileSync(f, "utf-8");
      return /select\s+\*\s+from\s+mailboxes|select\s+m\.\*\s+from\s+mailboxes/i.test(src) ? [rel(f)] : [];
    });
    expect(offenders).toEqual([]);
  });

  it("client components never import the OAuth clients, token source or repository", () => {
    const offenders = filesIn("components")
      .filter((f) => /^"use client"/.test(readFileSync(f, "utf-8")))
      .filter((f) => /from ["']@\/lib\/domain\/mailboxes\/(oauth\/(google|microsoft|registry|flow-state)|token-source|repository|service|connect-service)/.test(readFileSync(f, "utf-8")))
      .map(rel);
    expect(offenders).toEqual([]);
  });
});
