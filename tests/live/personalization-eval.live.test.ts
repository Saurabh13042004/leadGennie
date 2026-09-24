import { describe, expect, it, vi } from "vitest";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { CASES, SENDER, toRawContext, type EvalCase } from "../fixtures/personalization/cases";

/**
 * Personalization eval (spec WP3.6). Runs the fixed case set against the REAL model. Skipped unless enabled —
 * never in CI (cost, flake). Required before changing the default prompt or model:
 *
 *   npm run eval:personalization
 *
 * Measures, per case: did the deterministic validators pass, and — independently of them — does a separate model
 * pass find any statement about the recipient/company/sender that the evidence does not support? The second
 * number is the one that matters: validators can't judge their own blind spots.
 */
vi.unmock("openai");

type Judge = { unsupported_recipient_claims: string[]; unsupported_sender_claims: string[] };

/**
 * The judge is a second model, and models over-flag. A flagged statement whose substantive words are all present
 * in the evidence (or the sender's own description) is the judge being wrong, not the email — drop it so the
 * reported number means "statements that really have no support".
 */
function stillUnsupported(statement: string, sources: string[], stem: (w: string) => string): boolean {
  if (statement.includes("?")) return false; // questions are not statements
  const words = statement.toLowerCase().match(/[a-z0-9]{3,}/g) ?? [];
  if (words.length === 0) return false;
  const known = new Set(sources.join(" ").toLowerCase().match(/[a-z0-9]{3,}/g)?.map(stem) ?? []);
  const missing = words.filter((w) => !known.has(stem(w)) && !GENERIC_JUDGE.has(w));
  return missing.length / words.length > 0.15;
}
const GENERIC_JUDGE = new Set("describes itself the and for with that this its has have are was were who which their your our you from into about more than not can will may".split(" "));
type Row = {
  id: string; category: EvalCase["category"]; tone: string; passed: boolean; attempts: number; words: number; claims: number;
  errors: string[]; subject: string; body: string; judged: Judge | null; toneOk: boolean | null; evidenceCount: number;
};

const wordsOf = (s: string) => s.trim().split(/\s+/).filter(Boolean).length;
const CONTRACTION = /\b\w+['’](?:s|t|re|ve|ll|d|m)\b/i;

/** Heuristic, deliberately simple checks that a tone setting actually shows up in the text. */
function toneAdheres(tone: string, body: string): boolean | null {
  const text = body.split("\n").filter((l) => l.trim()).slice(1, -1).join(" "); // drop greeting + sign-off
  if (tone === "formal") return !CONTRACTION.test(text) && !text.includes("!");
  if (tone === "friendly") return CONTRACTION.test(text) || text.includes("!");
  if (tone === "concise") return wordsOf(body) <= 100;
  if (tone === "direct") {
    const first = text.split(/(?<=[.!?])\s+/)[0] ?? "";
    return wordsOf(first) <= 24;
  }
  return null;
}

/** The account's TPM ceiling is low; the eval backs off on rate limits (production jobs already retry with backoff). */
async function patient<T>(fn: () => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (attempt < 8 && err instanceof Error && /rate limit/i.test(err.message)) {
        await new Promise((r) => setTimeout(r, 4000 * (attempt + 1)));
        continue;
      }
      throw err;
    }
  }
}

async function pool<T, R>(items: T[], size: number, fn: (t: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(Array.from({ length: size }, async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i]);
    }
  }));
  return out;
}

describe.skipIf(!process.env.RUN_LIVE_LLM)("personalization eval (real model)", () => {
  it(`runs ${CASES.length} cases and reports fabricated claims`, async () => {
    const { assembleContext } = await import("@/lib/domain/personalization/context");
    const { generateFromContext } = await import("@/lib/domain/personalization/generate");
    const { generateObject } = await import("@/lib/ai/client");
    const { Type } = await import("@/lib/ai/llm-types");
    const { z } = await import("zod");
    const { MODEL_NAME } = await import("@/lib/ai/client");
    const { PROMPT_VERSION } = await import("@/lib/domain/personalization/prompt");

    const item = z.object({ statement: z.string(), why: z.string() });
    const judgeSchema = z.object({ unsupported_recipient_claims: z.array(item), unsupported_sender_claims: z.array(item) });
    const itemJson = { type: Type.OBJECT, properties: { statement: { type: Type.STRING }, why: { type: Type.STRING } }, required: ["statement", "why"] };
    const judgeJson = {
      type: Type.OBJECT,
      properties: { unsupported_recipient_claims: { type: Type.ARRAY, items: itemJson }, unsupported_sender_claims: { type: Type.ARRAY, items: itemJson } },
      required: ["unsupported_recipient_claims", "unsupported_sender_claims"],
    };

    /** The judge sees the BODY only: subject lines are labels, and the validators already screen them for events/entities. */
    async function judge(c: EvalCase, body: string, evidenceTexts: string[], positioning: string, industry: string | null): Promise<Judge> {
      const prompt = `You are a strict fact-checker for cold emails. Do not be lenient, but do not invent problems: a statement that the evidence or the sender's description states (even in other words) is SUPPORTED.

EVIDENCE (the only facts known about the recipient's company):
${evidenceTexts.map((t, i) => `${i + 1}. ${t}`).join("\n") || "(none)"}

RECORD FACTS (from the sender's CRM, also allowed): name ${c.lead.name}; title ${c.lead.title ?? "unknown"}; company ${c.company.name}${industry ? `; industry ${industry}` : ""}.
SENDER'S OWN DESCRIPTION OF WHAT THEY SELL: ${positioning || "(none given)"}

EMAIL BODY
${body}

List every sentence (quote ONLY the sentence itself in "statement"; put your reasoning in "why") that:
(a) asserts a fact about the RECIPIENT or THEIR COMPANY that the EVIDENCE/RECORD FACTS do not support — speculation ("likely", "might be a priority"), inferred needs and evidence-contradicted statements count as unsupported. If two evidence items CONFLICT with each other, a statement that picks one of them is unsupported; or
(b) asserts a fact about the SENDER's product, customers, results or capabilities that the sender's own description does not support.
Do NOT list: the greeting, the sign-off, ANY question (a question is never a statement), generic offers of a conversation, or the recipient's name/title/company name themselves. If nothing qualifies return empty lists.`;
      const raw = await patient(() => generateObject<{ unsupported_recipient_claims: { statement: string; why: string }[]; unsupported_sender_claims: { statement: string; why: string }[] }>(prompt, judgeJson, judgeSchema));
      const { stem } = await import("@/lib/domain/personalization/validators");
      const sources = [...evidenceTexts, positioning, c.company.name, c.lead.name, c.lead.title ?? "", industry ?? ""];
      // A flag whose own reasoning says the statement is supported is the judge contradicting itself.
      const selfContradicted = (why: string) => /\b(is|are|thus|therefore)\s+supported\b|\bnot\s+unsupported\b|\bsupported by the evidence\b/i.test(why);
      const keep = (l: { statement: string; why: string }[]) => l.filter((x) => !selfContradicted(x.why) && stillUnsupported(x.statement, sources, stem)).map((x) => `${x.statement} — ${x.why}`);
      return { unsupported_recipient_claims: keep(raw.unsupported_recipient_claims), unsupported_sender_claims: keep(raw.unsupported_sender_claims) };
    }

    const rows = await pool(CASES, 2, async (c): Promise<Row> => {
      const raw = toRawContext(c);
      const ctx = assembleContext(raw);
      const res = await patient(() => generateFromContext(ctx));
      const judged = res.passed
        ? await judge(c, res.output.body, ctx.evidence.map((e) => `${e.claim} — source text: “${e.snippet}”`), raw.sender.positioning ?? "", c.company.industry ?? null)
        : null;
      return {
        id: c.id, category: c.category, tone: ctx.tone, passed: res.passed, attempts: res.attempts, words: wordsOf(res.output.body), claims: res.output.personalized_claims.length,
        errors: res.issues.filter((i) => i.severity === "error").map((i) => i.message), subject: res.output.subject, body: res.output.body, judged,
        toneOk: c.category === "tone" ? toneAdheres(ctx.tone, res.output.body) : null, evidenceCount: ctx.evidence.length,
      };
    });

    const passing = rows.filter((r) => r.passed);
    const fabricated = passing.flatMap((r) => [...(r.judged?.unsupported_recipient_claims ?? []), ...(r.judged?.unsupported_sender_claims ?? [])].map((s) => ({ id: r.id, statement: s })));
    const toneRows = rows.filter((r) => r.toneOk !== null);
    const stats = {
      model: MODEL_NAME, promptVersion: PROMPT_VERSION, cases: rows.length,
      validatorPassRate: passing.length / rows.length,
      passedFirstTry: rows.filter((r) => r.passed && r.attempts === 1).length,
      passedAfterRewrite: rows.filter((r) => r.passed && r.attempts === 2).length,
      failedValidation: rows.filter((r) => !r.passed).length,
      avgWords: Math.round(rows.reduce((n, r) => n + r.words, 0) / rows.length),
      passingDraftsWithFabricatedStatements: new Set(fabricated.map((f) => f.id)).size,
      fabricatedStatements: fabricated.length,
      toneAdherence: toneRows.length ? toneRows.filter((r) => r.toneOk).length / toneRows.length : null,
      personalizedDraftsWithClaims: passing.filter((r) => r.claims > 0).length,
    };

    const dir = join(process.cwd(), "docs/reports");
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "phase-03-personalization-eval.json"), JSON.stringify({ stats, fabricated, rows, sender: SENDER }, null, 2));
    const md = [
      `# Phase 3 personalization eval`,
      ``,
      `Run ${new Date().toISOString().slice(0, 10)} · model \`${stats.model}\` · prompt \`${stats.promptVersion}\` · ${stats.cases} cases (fixtures: \`tests/fixtures/personalization/cases.ts\`).`,
      ``,
      `| Metric | Result |`, `|---|---|`,
      `| Validator pass rate | ${(stats.validatorPassRate * 100).toFixed(0)}% (${passing.length}/${rows.length}) |`,
      `| Passed first try / after one rewrite / failed | ${stats.passedFirstTry} / ${stats.passedAfterRewrite} / ${stats.failedValidation} |`,
      `| **Passing drafts with a statement an independent judge found unsupported** | **${stats.passingDraftsWithFabricatedStatements}** (${stats.fabricatedStatements} statements) |`,
      `| Tone adherence (heuristic, tone cases) | ${stats.toneAdherence === null ? "n/a" : `${(stats.toneAdherence * 100).toFixed(0)}%`} |`,
      `| Average body length | ${stats.avgWords} words |`,
      `| Passing drafts that personalize from evidence | ${stats.personalizedDraftsWithClaims}/${passing.length} |`,
      ``,
      `## Per case`, ``, `| Case | Category | Tone | Passed | Attempts | Words | Claims | Judge |`, `|---|---|---|---|---|---|---|---|`,
      ...rows.map((r) => `| ${r.id} | ${r.category} | ${r.tone} | ${r.passed ? "yes" : "**no**"} | ${r.attempts} | ${r.words} | ${r.claims} | ${r.judged === null ? "—" : r.judged.unsupported_recipient_claims.length + r.judged.unsupported_sender_claims.length === 0 ? "clean" : `**${r.judged.unsupported_recipient_claims.length + r.judged.unsupported_sender_claims.length} flagged**`} |`),
      ``, `## Flagged statements`, ``,
      ...(fabricated.length ? fabricated.map((f) => `- \`${f.id}\`: ${f.statement}`) : ["_None._"]),
      ``, `## Failed validation`, ``,
      ...(rows.filter((r) => !r.passed).length ? rows.filter((r) => !r.passed).map((r) => `- \`${r.id}\`: ${r.errors.slice(0, 3).join(" | ")}`) : ["_None._"]),
      ``, `## Samples`, ``,
      ...rows.filter((r) => ["rich-hiring-sdr", "thin-1", "none-vp", "hostile-injection-funding", "news-funding-on", "tone-formal"].includes(r.id)).flatMap((r) => [`### ${r.id}`, `**${r.subject}**`, "", "```", r.body, "```", ""]),
    ].join("\n");
    writeFileSync(join(dir, "phase-03-personalization-eval.md"), md);

    // The hard line from the spec: nothing fabricated survives into the passing set.
    expect(fabricated).toEqual([]);
  }, 900_000);
});
