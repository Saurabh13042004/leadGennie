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
        {paused ? <AlertTriangle className="w-5 h-5 text-yellow-300" /> : <Loader2 className="w-5 h-5 text-blue-400 animate-spin" />}
        <p className="text-white text-sm font-medium">{paused ? "Import paused" : "Importing leads…"}</p>
      </div>
      <div className="h-2 rounded-full bg-white/10 overflow-hidden">
        <div className="h-full bg-blue-400 transition-all duration-300" style={{ width: `${pct}%` }} />
      </div>
      <p className="text-xs text-neutral-500 tabular-nums">
        {progress.processed.toLocaleString()} of {progress.total.toLocaleString()} rows processed ({pct}%)
      </p>
      {error && <p className="text-sm text-red-400">{error}</p>}
      {paused && (
        <button onClick={onRetry} className="w-full bg-white text-black font-semibold text-sm px-4 py-2.5 rounded-lg hover:bg-neutral-200 transition-colors">
          Retry — continue where it stopped
        </button>
      )}
      {!paused && <p className="text-xs text-neutral-600">Keep this window open. Leads already imported are saved even if something fails.</p>}
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
    ["Created", job.created, "text-green-400"],
    ["Updated", job.updated, "text-blue-400"],
    ["Duplicates", job.duplicate, "text-neutral-400"],
    ["Skipped", job.skipped, "text-yellow-400"],
    ["Failed", job.failed, "text-red-400"],
  ];
  const interrupted = job.status === "interrupted";
  return (
    <div className="space-y-5">
      <div className="flex flex-col items-center text-center py-2">
        {interrupted ? <AlertTriangle className="w-12 h-12 text-yellow-300 mb-4" /> : <CheckCircle2 className="w-12 h-12 text-green-400 mb-4" />}
        <p className="text-white font-medium">{interrupted ? "Import incomplete" : "Import complete"}</p>
        <p className="text-sm text-neutral-500 mt-1">
          {job.processedRows.toLocaleString()} of {job.totalRows.toLocaleString()} rows processed. Safe to re-upload the same file — existing leads are matched, never duplicated.
        </p>
      </div>

      <div className="grid grid-cols-5 gap-2 text-center">
        {stats.map(([label, value, color]) => (
          <div key={label} className="rounded-lg border border-white/10 bg-white/[0.02] py-3">
            <p className={cn("text-lg font-semibold tabular-nums", color)}>{value.toLocaleString()}</p>
            <p className="text-[11px] text-neutral-500 mt-0.5">{label}</p>
          </div>
        ))}
      </div>
      {(job.risky > 0 || job.blocked > 0) && (
        <p className="text-xs text-neutral-400 text-center">
          {job.risky > 0 && <>{job.risky} imported with a <b className="text-yellow-300">risky</b> email (role/disposable). </>}
          {job.blocked > 0 && <>{job.blocked} imported but <b className="text-orange-300">blocked</b> (Do Not Contact).</>}
        </p>
      )}

      {report.length > 0 && (
        <div className="space-y-2">
          <div className="rounded-lg border border-white/10 bg-white/[0.02] max-h-40 overflow-y-auto">
            <div className="px-3 py-2 border-b border-white/10 text-xs text-neutral-500 sticky top-0 bg-[#0A0A0A]">
              Row-level detail ({report.length.toLocaleString()})
            </div>
            <ul className="text-xs divide-y divide-white/5">
              {report.slice(0, 200).map((e, i) => (
                <li key={i} className="px-3 py-1.5 flex justify-between gap-3 text-neutral-400">
                  <span className="text-neutral-500 shrink-0">Row {e.row}</span>
                  <span className={cn("text-right", e.severity === "error" && "text-red-300")}>{e.reason}</span>
                </li>
              ))}
            </ul>
          </div>
          <button
            onClick={() => downloadCsv(`${fileName.replace(/\.csv$/i, "")}-import-issues.csv`, buildIssuesCsv(headers, rows, report))}
            className="w-full flex items-center justify-center gap-2 text-sm text-white border border-white/10 rounded-lg px-3 py-2 hover:bg-white/5 transition-colors"
          >
            <Download className="w-4 h-4" />
            Download issues as CSV
          </button>
        </div>
      )}

      <button onClick={onDone} className="w-full bg-white text-black font-semibold text-sm px-5 py-2.5 rounded-lg hover:bg-neutral-200 transition-colors">
        Done
      </button>
    </div>
  );
}
