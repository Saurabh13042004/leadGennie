/**
 * LinkedIn profile pages put the useful part of a person's card in <title>:
 *   "Sarah Chen - VP Sales - Acme | LinkedIn"        name - title - company
 *   "(3) Sarah Chen - Head of Growth | LinkedIn"     notification-count prefix, headline only
 *   "Sarah Chen | LinkedIn"                          name only
 * Reading it is deterministic and free, so it runs before (and often instead of) any model call.
 */

const TITLE_WORDS =
  /\b(ceo|cto|cfo|coo|cmo|cro|founder|co-?founder|owner|president|partner|principal|vp|vice president|head|director|manager|lead|chief|officer|engineer|developer|architect|designer|analyst|consultant|advisor|specialist|executive|recruiter|sales|marketing|growth|product|operations|account|associate|scientist|researcher|strategist|coordinator|administrator|supervisor|intern)\b/i;

/** Titles LinkedIn shows on its sign-in / verification walls — never a person. */
const WALL_TITLE = /^(linkedin|sign up|sign in|log in|login|join linkedin|security verification|authwall)\b/i;

export type ParsedLinkedinTitle = { name?: string; jobTitle?: string; company?: string };

export function parseLinkedinTitle(rawTitle: string): ParsedLinkedinTitle {
  let t = (rawTitle ?? "").replace(/\s+/g, " ").trim();
  t = t.replace(/^\(\d+\)\s*/, "").replace(/\s*[|–—-]\s*LinkedIn\s*$/i, "").trim();
  if (!t) return {};
  const parts = t.split(/\s+[-–—|]\s+/).map((p) => p.trim()).filter(Boolean);
  const [name, second, ...rest] = parts;
  if (!name || WALL_TITLE.test(name)) return {};
  if (!second) return { name };
  if (rest.length > 0) return { name, jobTitle: second, company: rest.join(" - ") };
  // Two parts is ambiguous ("Name - Title" vs "Name - Company"): only claim what looks like a role.
  return TITLE_WORDS.test(second) ? { name, jobTitle: second } : { name, company: second };
}

/** Canonical profile URL, or null when this isn't a personal profile page. */
export function linkedinProfilePath(url: string): string | null {
  try {
    const u = new URL(url);
    const host = u.hostname.toLowerCase();
    if (host !== "linkedin.com" && !host.endsWith(".linkedin.com")) return null;
    const m = u.pathname.match(/^\/in\/([^/]+)/i);
    return m ? m[1] : null;
  } catch {
    return null;
  }
}
