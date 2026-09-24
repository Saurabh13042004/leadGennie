import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Rule 15 (docs/04-engineering-rules.md): the agent core cannot reach the database, the research service, the job
 * queue, server actions, or anything that sends mail. Also enforced by eslint; this test is the backstop that runs
 * in `npm test` and names the offender.
 */
const ROOT = join(process.cwd(), "lib/agent");
const ALLOWED = [/^\.\.?\//, /^zod$/, /^@\/lib\/agent\//, /^@\/lib\/ai\//, /^@\/lib\/api\/errors$/, /^@\/lib\/log$/];

function* files(dir: string): Generator<string> {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) yield* files(full);
    else if (name.endsWith(".ts")) yield full;
  }
}

describe("lib/agent import boundary", () => {
  const offenders: string[] = [];
  for (const file of files(ROOT)) {
    const src = readFileSync(file, "utf-8");
    for (const m of src.matchAll(/(?:from|import)\s+["']([^"']+)["']/g)) {
      if (!ALLOWED.some((re) => re.test(m[1]))) offenders.push(`${relative(process.cwd(), file)} imports "${m[1]}"`);
    }
  }

  it("imports nothing outside the allow-list (no db, domain, intelligence, jobs, actions, email, campaigns)", () => {
    expect(offenders).toEqual([]);
  });

  it("does not use fetch / process.env / sql directly either", () => {
    for (const file of files(ROOT)) {
      const src = readFileSync(file, "utf-8");
      expect(src, relative(process.cwd(), file)).not.toMatch(/\bfetch\(|process\.env|\bsql`|sql\.query/);
    }
  });
});
