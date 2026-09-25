/** Plain types + helpers for the /compare/* pages (CompareTemplate). */

export interface CompareBullet {
  title: string;
  desc: string;
}

export interface CompareTableRow {
  feature: string;
  their: string;
  ours: string;
  oursHighlight?: boolean;
}

export type CellMark = "yes" | "no" | "partial" | "neutral";

/** Icon for the competitor's cell, read from its own wording ("No — …" / "Yes …"); everything else is a partial fit. */
export function theirMark(text: string): CellMark {
  if (/^no\b/i.test(text)) return "no";
  if (/^yes\b/i.test(text)) return "yes";
  return "partial";
}

/** Our cell gets a check only where the page data marks it as a LeadGennie strength. */
export function ourMark(row: CompareTableRow): CellMark {
  return row.oursHighlight ? "yes" : "neutral";
}

export const COMPARE_PAGES = [
  { href: "/compare/apollo", label: "Apollo.io" },
  { href: "/compare/clay", label: "Clay" },
  { href: "/compare/hubspot", label: "HubSpot" },
  { href: "/compare/instantly", label: "Instantly" },
];
