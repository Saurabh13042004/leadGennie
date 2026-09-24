import Papa from "papaparse";
import type { ReportEntry } from "@/lib/db/lead-import";
import type { RawRow } from "@/lib/domain/leads/import/preview";

/**
 * Error CSV: the user's ORIGINAL columns plus the row number, severity and
 * reason — so they can fix the file and re-upload it (re-importing is safe).
 */
export function buildIssuesCsv(headers: string[], rows: RawRow[], entries: ReportEntry[]): string {
  const out = entries.map((e) => {
    const original = rows[e.row - 2] ?? {};
    return {
      _row: e.row,
      _severity: e.severity,
      _issue: e.reason,
      ...Object.fromEntries(headers.map((h) => [h, original[h] ?? ""])),
    };
  });
  // Guard against spreadsheet formula injection from cell values that start with = + - @.
  const safe = out.map((r) =>
    Object.fromEntries(Object.entries(r).map(([k, v]) => [k, typeof v === "string" && /^[=+\-@]/.test(v) ? `'${v}` : v])),
  );
  return Papa.unparse(safe, { columns: ["_row", "_severity", "_issue", ...headers] });
}

export function downloadCsv(filename: string, csv: string) {
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
