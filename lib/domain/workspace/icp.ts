import { z } from "zod";
import { normalizeDomain } from "@/lib/domain/companies/normalize";

/**
 * Workspace ICP (D-07), stored in workspaces.icp. Phase 1 is a deliberately
 * simple, human-editable definition. Phase 2A maps it onto the engine's weighted
 * scoring schema (docs/intelligence-engine/scoring.md) — additive: the `version`
 * field lets that mapping evolve without a data migration. No scoring happens here.
 */

const item = z.string().trim().min(1).max(80);
const list = z.array(item).max(30);

export const icpSchema = z
  .object({
    version: z.literal(1).default(1),
    industries: list.default([]),
    employee_range: z
      .object({
        min: z.number().int().min(1).max(10_000_000).nullable(),
        max: z.number().int().min(1).max(10_000_000).nullable(),
      })
      .refine((r) => r.min === null || r.max === null || r.min <= r.max, { message: "Minimum employees must not exceed the maximum" })
      .nullable()
      .default(null),
    geographies: list.default([]),
    titles: list.default([]),
    exclusions: z
      .object({ industries: list.default([]), domains: z.array(z.string().max(253)).max(50).default([]), titles: list.default([]) })
      .default({ industries: [], domains: [], titles: [] }),
  })
  .strict();

export type Icp = z.infer<typeof icpSchema>;

export const EMPTY_ICP: Icp = icpSchema.parse({});

/** "a, b\nc" → ["a","b","c"] — trimmed, de-duplicated (case-insensitively), order kept. */
export function parseList(text: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of text.split(/[,\n;]/)) {
    const v = part.trim();
    if (v && !seen.has(v.toLowerCase())) {
      seen.add(v.toLowerCase());
      out.push(v);
    }
  }
  return out;
}

/** Excluded domains are normalized; anything that isn't a plausible domain is an error, not a silent drop. */
export function normalizeExcludedDomains(domains: string[]): { domains: string[]; invalid: string[] } {
  const ok: string[] = [];
  const invalid: string[] = [];
  for (const d of domains) {
    const n = normalizeDomain(d);
    if (n) ok.push(n);
    else invalid.push(d);
  }
  return { domains: Array.from(new Set(ok)), invalid };
}

/** True once the user has said something meaningful about who they sell to. */
export function isIcpDefined(icp: Icp | null | undefined): boolean {
  if (!icp) return false;
  const range = icp.employee_range;
  return (
    icp.industries.length > 0 ||
    icp.titles.length > 0 ||
    icp.geographies.length > 0 ||
    !!range && (range.min !== null || range.max !== null)
  );
}

/** Reads jsonb from the database defensively: an unparseable/legacy value counts as "not defined", never a crash. */
export function parseStoredIcp(raw: unknown): Icp | null {
  if (raw === null || raw === undefined) return null;
  const parsed = icpSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}
