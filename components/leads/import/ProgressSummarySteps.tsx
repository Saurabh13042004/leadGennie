"use client";

import { CheckCircle2, Download, Loader2, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ImportJobView } from "@/lib/domain/leads/import/service";
import type { ReportEntry } from "@/lib/db/lead-import";
import type { RawRow } from "@/lib/domain/leads/import/preview";
import { buildIssuesCsv, downloadCsv } from "./csv";

export function ProgressStep({
  progress, error, paused, onRetry,
}: {
  progress: { processed: number; total: number };
  error: string | null;
  paused: boolean;
  onRetry: () => void;
}) {
  const pct = progress.total > 0 ? Math.round((progress.processed / progress.total) * 100) : 0;
  return (
    <div className="space-y-4 py-4" role="status" aria-live="polite">
      <div className="flex items-center gap-3">
        {paused ? <AlertTriangle className="w-5 h-5 text-amber-500" /> : <Loader2 className="w-5 h-5 text-indigo-600 animate-spin" />}
        <p className="text-neutral-900 text-sm font-semibold">{paused ? "Import paused" : "Importing leads…"}</p>
      </div>
      <div className="h-2 rounded-full bg-neutral-100 overflow-hidden">
        <div className="h-full bg-indigo-500 transition-all duration-300" style={{ width: `${pct}%` }} />
      </div>
      <p className="text-xs text-neutral-500 tabular-nums">
        {progress.processed.toLocaleString()} of {progress.total.toLocaleString()} rows processed ({pct}%)
      </p>
      {error && <p className="text-sm text-rose-600">{error}</p>}
      {paused && (
        <button onClick={onRetry} className="w-full bg-neutral-900 text-white font-semibold text-sm px-4 py-2.5 rounded-xl hover:bg-neutral-800 transition-colors">
          Retry — continue where it stopped
        </button>
      )}
      {!paused && <p className="text-xs text-neutral-400">Keep this window open. Leads already imported are saved even if something fails.</p>}
    </div>
  );
}

export function SummaryStep({
  job, report, headers, rows, fileName, onDone,
}: {
  job: ImportJobView;
  report: ReportEntry[];
  headers: string[];
  rows: RawRow[];
  fileName: string;
  onDone: () => void;
}) {
  const stats: [string, number, string][] = [
    ["Created", job.created, "text-emerald-600"],
    ["Updated", job.updated, "text-indigo-600"],
    ["Duplicates", job.duplicate, "text-neutral-500"],
    ["Skipped", job.skipped, "text-amber-600"],
    ["Failed", job.failed, "text-rose-600"],
  ];
  const interrupted = job.status === "interrupted";
  return (
    <div className="space-y-5">
      <div className="flex flex-col items-center text-center py-2">
        {interrupted ? (
          <div className="w-14 h-14 rounded-xl bg-amber-50 flex items-center justify-center mb-4">
            <AlertTriangle className="w-7 h-7 text-amber-500" />
          </div>
        ) : (
          <div className="w-14 h-14 rounded-xl bg-emerald-50 flex items-center justify-center mb-4">
            <CheckCircle2 className="w-7 h-7 text-emerald-500" />
          </div>
        )}
        <p className="text-neutral-900 font-semibold">{interrupted ? "Import incomplete" : "Import complete"}</p>
        <p className="text-sm text-neutral-500 mt-1">
          {job.processedRows.toLocaleString()} of {job.totalRows.toLocaleString()} rows processed. Safe to re-upload the same file — existing leads are matched, never duplicated.
        </p>
      </div>

      <div className="grid grid-cols-5 gap-2 text-center">
        {stats.map(([label, value, color]) => (
          <div key={label} className="rounded-lg border border-neutral-200 bg-neutral-50 py-3">
            <p className={cn("text-lg font-bold tabular-nums", color)}>{value.toLocaleString()}</p>
            <p className="text-[11px] text-neutral-500 mt-0.5">{label}</p>
          </div>
        ))}
      </div>
      {(job.risky > 0 || job.blocked > 0) && (
        <p className="text-xs text-neutral-500 text-center">
          {job.risky > 0 && <>{job.risky} imported with a <b className="text-amber-600">risky</b> email (role/disposable). </>}
          {job.blocked > 0 && <>{job.blocked} imported but <b className="text-orange-600">blocked</b> (Do Not Contact).</>}
        </p>
      )}

      {report.length > 0 && (
        <div className="space-y-2">
          <div className="rounded-lg border border-neutral-200 bg-neutral-50 max-h-40 overflow-y-auto">
            <div className="px-3 py-2 border-b border-neutral-200 text-xs text-neutral-500 sticky top-0 bg-neutral-50">
              Row-level detail ({report.length.toLocaleString()})
            </div>
            <ul className="text-xs divide-y divide-neutral-100">
              {report.slice(0, 200).map((e, i) => (
                <li key={i} className="px-3 py-1.5 flex justify-between gap-3 text-neutral-500">
                  <span className="text-neutral-400 shrink-0">Row {e.row}</span>
                  <span className={cn("text-right", e.severity === "error" && "text-rose-600")}>{e.reason}</span>
                </li>
              ))}
            </ul>
          </div>
          <button
            onClick={() => downloadCsv(`${fileName.replace(/\.csv$/i, "")}-import-issues.csv`, buildIssuesCsv(headers, rows, report))}
            className="w-full flex items-center justify-center gap-2 text-sm text-neutral-700 border border-neutral-200 bg-white rounded-lg px-3 py-2 hover:bg-neutral-50 hover:border-neutral-300 transition-colors"
          >
            <Download className="w-4 h-4" />
            Download issues as CSV
          </button>
        </div>
      )}

      <button onClick={onDone} className="w-full bg-neutral-900 text-white font-semibold text-sm px-5 py-2.5 rounded-xl hover:bg-neutral-800 transition-colors">
        Done
      </button>
    </div>
  );
}
