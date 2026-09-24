/**
 * Company-identity normalization. Conservative by design (docs: phase-01
 * "Risks"): we only strip legal-form suffixes, never descriptive words, so
 * "Dice Solutions" and "Dice" stay distinct.
 *
 * Dependency-free on purpose: scripts/backfill-companies.mjs imports this file
 * directly (Node type-stripping), so it must not import anything.
 */

const LEGAL_SUFFIXES = new Set([
  "inc", "incorporated", "llc", "llp", "lp", "ltd", "limited", "corp", "corporation", "co", "company",
  "gmbh", "ag", "plc", "pvt", "private", "pty", "sa", "bv", "nv", "oy", "ab", "sarl", "srl", "spa", "kk", "pte",
]);

// Built via RegExp() so the file compiles under the project's ES2017 target.
const NON_ALNUM = new RegExp("[^\\p{L}\\p{N}]+", "gu");
const COMBINING_MARKS = new RegExp("\\p{M}+", "gu");

function fold(input: string): string {
  return input
    .normalize("NFKD")
    .replace(COMBINING_MARKS, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(NON_ALNUM, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Matching key for a company name; "" when nothing usable remains. */
export function normalizeCompanyName(name: string | null | undefined): string {
  const folded = fold(name ?? "");
  if (!folded) return "";
  let tokens = folded.split(" ");
  if (tokens.length > 1 && tokens[0] === "the") tokens = tokens.slice(1);
  while (tokens.length > 1 && LEGAL_SUFFIXES.has(tokens[tokens.length - 1])) tokens.pop();
  return tokens.join(" ");
}

const HOST_RE = /^(?=.{1,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z][a-z0-9-]{1,62}$/;

/**
 * Website / bare domain / email → bare lowercase host without "www.".
 * Returns null for anything that isn't a plausible public hostname. Does not
 * collapse subdomains to a registrable domain (that needs the public-suffix
 * list); `eng.acme.com` stays distinct from `acme.com`.
 */
export function normalizeDomain(input: string | null | undefined): string | null {
  let s = (input ?? "").trim().toLowerCase();
  if (!s) return null;
  if (s.includes("@")) s = s.slice(s.lastIndexOf("@") + 1);
  s = s.replace(/^[a-z][a-z0-9+.-]*:\/\//, "");
  s = s.split(/[/?#]/)[0];
  s = s.replace(/^[^@]*@/, "").replace(/:\d+$/, "").replace(/\.$/, "");
  s = s.replace(/^www\d?\./, "");
  return HOST_RE.test(s) ? s : null;
}

/** Match key for a company known only by its domain: the leading label ("acme.com" → "acme"). */
export function nameKeyFromDomain(domain: string): string {
  return normalizeCompanyName(domain.split(".")[0]);
}
