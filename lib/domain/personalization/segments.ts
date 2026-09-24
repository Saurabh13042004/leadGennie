import type { DraftClaim } from "./types";

export type BodySegment = { text: string; evidenceId: number | null };

/**
 * Splits an email body into plain and evidence-backed runs so the preview can highlight each personalized
 * phrase and link it to its source. Matching is exact-first, then whitespace/case-insensitive; a claim whose
 * phrase can no longer be found (the user edited it away) simply isn't highlighted. Overlaps keep the earliest.
 */
export function segmentBody(body: string, claims: DraftClaim[]): BodySegment[] {
  const spans: { start: number; end: number; evidenceId: number }[] = [];
  for (const c of claims) {
    const found = locate(body, c.text);
    if (found) spans.push({ ...found, evidenceId: c.evidenceId });
  }
  spans.sort((a, b) => a.start - b.start || b.end - a.end);
  const out: BodySegment[] = [];
  let cursor = 0;
  for (const s of spans) {
    if (s.start < cursor) continue; // overlaps a span we already kept
    if (s.start > cursor) out.push({ text: body.slice(cursor, s.start), evidenceId: null });
    out.push({ text: body.slice(s.start, s.end), evidenceId: s.evidenceId });
    cursor = s.end;
  }
  if (cursor < body.length) out.push({ text: body.slice(cursor), evidenceId: null });
  return out.length > 0 ? out : [{ text: body, evidenceId: null }];
}

function locate(body: string, phrase: string): { start: number; end: number } | null {
  const exact = body.indexOf(phrase);
  if (exact >= 0) return { start: exact, end: exact + phrase.length };
  // Whitespace- and case-insensitive: build a regex from the phrase's words.
  const words = phrase.trim().split(/\s+/).filter(Boolean).map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  if (words.length === 0) return null;
  const m = new RegExp(words.join("\\s+"), "i").exec(body);
  return m ? { start: m.index, end: m.index + m[0].length } : null;
}
