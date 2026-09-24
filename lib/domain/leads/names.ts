/**
 * Best-effort split of a display name into first/last. Deliberately
 * conservative and lossy — `full_name` stays authoritative for display; these
 * two fields exist for personalization ({{first_name}}) and matching.
 *
 * Dependency-free on purpose: scripts/backfill-lead-names.mjs imports this file
 * directly (Node type-stripping), so it must not import anything.
 */

export type SplitName = { firstName: string | null; lastName: string | null };

const HONORIFICS = new Set(["mr", "mrs", "ms", "miss", "mx", "dr", "prof", "sir", "madam"]);
const SUFFIXES = new Set(["jr", "sr", "ii", "iii", "iv", "phd", "md", "mba", "cpa", "esq", "pmp", "cfa"]);
// Surname particles that belong with the last name ("Ludwig van Beethoven").
const PARTICLES = new Set(["van", "von", "de", "del", "della", "di", "da", "dos", "du", "la", "le", "bin", "ibn", "al", "el", "st"]);

function clean(token: string): string {
  return token.replace(/^[.,]+|[.,]+$/g, "");
}

export function splitFullName(fullName: string | null | undefined): SplitName {
  const raw = (fullName ?? "").replace(/\s+/g, " ").trim();
  if (!raw) return { firstName: null, lastName: null };

  // "Last, First" form (one comma, both sides non-empty). A trailing ", Jr." / ", PhD"
  // is a suffix, not a surname, so it is stripped instead.
  const commaParts = raw.split(",").map((p) => p.trim());
  let working = raw;
  if (commaParts.length === 2 && commaParts[0] && commaParts[1]) {
    const right = clean(commaParts[1]).toLowerCase();
    if (SUFFIXES.has(right)) working = commaParts[0];
    else working = `${commaParts[1]} ${commaParts[0]}`;
  } else if (commaParts.length > 2) {
    working = commaParts[0];
  }

  const tokens = working.split(" ").map(clean).filter(Boolean);
  while (tokens.length > 1 && HONORIFICS.has(tokens[0].toLowerCase())) tokens.shift();
  while (tokens.length > 1 && SUFFIXES.has(tokens[tokens.length - 1].toLowerCase())) tokens.pop();

  if (tokens.length === 0) return { firstName: null, lastName: null };
  if (tokens.length === 1) return { firstName: tokens[0], lastName: null };

  // Middle names stay with the first name ("Mary Jane Watson" → "Mary Jane" / "Watson");
  // particles stay with the last name ("Ludwig van Beethoven" → "Ludwig" / "van Beethoven").
  let lastStart = tokens.length - 1;
  while (lastStart > 1 && PARTICLES.has(tokens[lastStart - 1].toLowerCase())) lastStart--;
  return {
    firstName: tokens.slice(0, lastStart).join(" "),
    lastName: tokens.slice(lastStart).join(" "),
  };
}

/** Display name from parts — used when a source supplies first/last but no full name. */
export function joinName(firstName: string | null | undefined, lastName: string | null | undefined): string {
  return [firstName, lastName]
    .map((p) => (p ?? "").trim())
    .filter(Boolean)
    .join(" ");
}
