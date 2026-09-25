import type { Proposal } from "./extractors";

/**
 * Reads a LinkedIn profile's own text for the person's title and company, without a model — free, instant, and it
 * cannot hallucinate. It looks in the places LinkedIn puts them, most reliable first:
 *   1. the top card's "Current company: X" button label (sent as a hint by the extension),
 *   2. the headline under the name ("VP Sales at Acme | Ex-Initech"),
 *   3. the first entry of the Experience section ("Acme · Full-time").
 * Anything it can't find is simply left for the model (or the person) to fill in.
 */

const NOISE = [
  /^·/, /^\(?\d+(st|nd|rd|th)\)?$/i, /^(he|she|they)\s*\/\s*(him|her|them)/i, /^\d[\d,]*\+?\s*(connections?|followers?|mutual)/i,
  /contact info$/i, /^(message|connect|follow|more|pending|save|resources|open to)\b/i, /^(1st|2nd|3rd)\b/i, /^\W+$/,
];
/** Section titles: the top card ends at the first of these, so nothing below them can be mistaken for a headline. */
const SECTION = /^(about|experience|education|activity|featured|highlights|skills|services|licenses|volunteering|interests|recommendations)$/i;
const EMPLOYMENT = /(full-time|part-time|self-employed|freelance|contract|internship|apprenticeship|seasonal|permanent)/i;
const clip = (s: string, n = 120) => s.replace(/\s+/g, " ").trim().slice(0, n);
const isNoise = (l: string) => NOISE.some((r) => r.test(l));

function fromHints(hints: string[]): string | undefined {
  for (const h of hints) {
    const m = /current company:\s*([^.]+?)(?:\.\s|\.$|$)/i.exec(h);
    if (m && m[1].trim()) return clip(m[1]);
  }
  return undefined;
}

/** "VP Sales at Acme | Ex-Initech" → { title: "VP Sales", company: "Acme" } */
export function parseHeadline(headline: string): { title?: string; company?: string } {
  const m = /^(.+?)\s+(?:at|@)\s+(.+)$/i.exec(headline.trim());
  if (!m) return {};
  const company = m[2].split(/\s*[|·•]\s*|\s+[-–—]\s+|,\s+/)[0]?.trim();
  const title = m[1].replace(/[|·•,\-–—\s]+$/, "").trim();
  return { title: title ? clip(title) : undefined, company: company ? clip(company) : undefined };
}

export function extractLinkedinText(text: string, name: string | undefined, hints: string[]): Proposal {
  const out: Proposal = {};
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);

  const hinted = fromHints(hints);
  if (hinted) out.company = hinted;

  // ---- headline: the first real line under the name ------------------------------------------------------------
  let start = 0;
  if (name) {
    const i = lines.findIndex((l) => l.toLowerCase() === name.toLowerCase() || l.toLowerCase().startsWith(`${name.toLowerCase()} `));
    if (i >= 0) start = i + 1;
  }
  // The headline is one of the first few real lines under the name, before any section heading — never a sentence from About.
  const topCard: string[] = [];
  for (const l of lines.slice(start, start + 14)) {
    if (SECTION.test(l)) break;
    if (!isNoise(l) && l.length >= 4 && l.length <= 220 && l.toLowerCase() !== (name ?? "").toLowerCase()) topCard.push(l);
    if (topCard.length >= 4) break;
  }
  const headline = topCard.find((l) => /\s(?:at|@)\s/i.test(l)) ?? topCard[0];
  if (headline) {
    const { title, company } = parseHeadline(headline);
    if (title && title.split(/\s+/).length <= 8) out.jobTitle = title; // a real title is short; a sentence is not
    if (company && !out.company) out.company = company;
  }

  // ---- Experience: "<Company> · Full-time" under the first role ---------------------------------------------------
  const exp = lines.findIndex((l) => /^experience$/i.test(l));
  if (exp >= 0 && (!out.company || !out.jobTitle)) {
    const window = lines.slice(exp + 1, exp + 14);
    const i = window.findIndex((l) => new RegExp(`^.+?\\s·\\s(?:${EMPLOYMENT.source})`, "i").test(l));
    if (i >= 0) {
      const company = window[i].split(/\s·\s/)[0]?.trim();
      if (company && !out.company) out.company = clip(company);
      const title = window[i - 1]?.trim();
      if (title && !out.jobTitle && !isNoise(title) && title.length <= 120) out.jobTitle = clip(title);
    }
  }
  return out;
}
