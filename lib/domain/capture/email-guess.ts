import { splitFullName } from "@/lib/domain/leads/names";
import { normalizeCompanyName } from "@/lib/domain/companies/normalize";

/**
 * Educated guesses at a work email, from a person's name and their company's domain.
 *
 * THESE ARE GUESSES, NOT FACTS. They are never saved on their own: the extension shows them as "auto-generated — may not
 * be correct", the person chooses one (or types the real address), and a chosen guess is recorded as low-confidence
 * provenance so it can be replaced later. Nothing here verifies that a mailbox exists.
 *
 * Pure and dependency-light: no I/O (DNS and existing-email lookups are done by the caller and passed in).
 */

// Letters Unicode can't decompose into base + accent; transliterated the way mail systems usually spell them.
const TRANSLIT: Record<string, string> = { ł: "l", ø: "o", đ: "d", ð: "d", ß: "ss", æ: "ae", œ: "oe", þ: "th", ħ: "h", ı: "i" };

const fold = (s: string) =>
  s
    .toLowerCase()
    .replace(/[łøđðßæœþħı]/g, (c) => TRANSLIT[c] ?? c)
    .normalize("NFKD")
    .replace(new RegExp("[\\u0300-\\u036f]", "g"), "") // combining accent marks
    .replace(/[^a-z0-9]/g, "");

export type PatternId = "first.last" | "first" | "flast" | "firstlast" | "f.last" | "first_last" | "firstl" | "last" | "last.first" | "first-last";

type Parts = { first: string; last: string };

/** Ordered by how common each format is at companies (most common first). */
const PATTERNS: { id: PatternId; needsLast: boolean; build: (p: Parts) => string }[] = [
  { id: "first.last", needsLast: true, build: ({ first, last }) => `${first}.${last}` },
  { id: "first", needsLast: false, build: ({ first }) => first },
  { id: "flast", needsLast: true, build: ({ first, last }) => `${first[0]}${last}` },
  { id: "firstlast", needsLast: true, build: ({ first, last }) => `${first}${last}` },
  { id: "f.last", needsLast: true, build: ({ first, last }) => `${first[0]}.${last}` },
  { id: "first_last", needsLast: true, build: ({ first, last }) => `${first}_${last}` },
  { id: "firstl", needsLast: true, build: ({ first, last }) => `${first}${last[0]}` },
  { id: "last", needsLast: true, build: ({ last }) => last },
  { id: "last.first", needsLast: true, build: ({ first, last }) => `${last}.${first}` },
  { id: "first-last", needsLast: true, build: ({ first, last }) => `${first}-${last}` },
];

/** First and last name as lowercase ASCII, or null when there isn't a usable first name. */
export function namePartsForEmail(fullName: string | null | undefined, first?: string | null, last?: string | null): Parts | null {
  const split = splitFullName(fullName);
  const f = fold((first ?? split.firstName ?? "").split(/\s+/)[0] ?? ""); // "Mary Jane" → mary
  const l = fold(last ?? split.lastName ?? "");
  if (!f) return null;
  return { first: f, last: l };
}

export type EmailGuess = {
  email: string;
  pattern: PatternId;
  /** "existing": this format matches emails already in the workspace at that domain. "common": a typical company format. */
  basis: "existing" | "common";
  /** For basis "existing": how many of your existing emails at this domain use this format. */
  matches?: number;
};

export type KnownEmail = { fullName?: string | null; firstName?: string | null; lastName?: string | null; email: string };

/** Which formats explain the emails you already have at this domain? (pattern → number of people it explains) */
export function inferPatterns(known: KnownEmail[]): Map<PatternId, number> {
  const votes = new Map<PatternId, number>();
  for (const k of known) {
    const parts = namePartsForEmail(k.fullName, k.firstName, k.lastName);
    const local = k.email.toLowerCase().split("@")[0]?.split("+")[0];
    if (!parts || !local) continue;
    for (const p of PATTERNS) {
      if (p.needsLast && !parts.last) continue;
      if (p.build(parts) === local) votes.set(p.id, (votes.get(p.id) ?? 0) + 1);
    }
  }
  return votes;
}

/**
 * Candidate addresses for `fullName` at `domain`, best first. When the workspace already has emails at that domain, the
 * format they follow is ranked first (that is real evidence about how THIS company does it); the rest follow in order of how
 * common each format is. Without a last name only the first-name format is offered.
 */
export function guessEmails(input: { fullName: string; firstName?: string | null; lastName?: string | null; domain: string; known?: KnownEmail[]; limit?: number }): EmailGuess[] {
  const parts = namePartsForEmail(input.fullName, input.firstName, input.lastName);
  const domain = input.domain.trim().toLowerCase();
  if (!parts || !domain) return [];

  const votes = inferPatterns(input.known ?? []);
  const usable = PATTERNS.filter((p) => !p.needsLast || parts.last);
  const ranked = [...usable].sort((a, b) => (votes.get(b.id) ?? 0) - (votes.get(a.id) ?? 0) || PATTERNS.indexOf(a) - PATTERNS.indexOf(b));

  const seen = new Set<string>();
  const out: EmailGuess[] = [];
  for (const p of ranked) {
    const local = p.build(parts);
    if (!local) continue;
    const email = `${local}@${domain}`;
    if (seen.has(email)) continue;
    seen.add(email);
    const matches = votes.get(p.id);
    out.push(matches ? { email, pattern: p.id, basis: "existing", matches } : { email, pattern: p.id, basis: "common" });
  }
  return out.slice(0, input.limit ?? 6);
}

/**
 * Website guesses from a company NAME ("Acme Inc" → acme.com, acme.io …). Even weaker than an email guess — a different company
 * can own the obvious domain — so the caller only offers ones that at least accept mail, and the person must choose one.
 */
export function guessDomains(company: string | null | undefined): string[] {
  const slug = fold(normalizeCompanyName(company));
  if (slug.length < 3 || slug.length > 40) return [];
  return [".com", ".io", ".ai", ".co"].map((tld) => `${slug}${tld}`);
}
