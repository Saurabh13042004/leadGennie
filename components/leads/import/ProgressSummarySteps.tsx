"use client";

import { ArrowClockwise, CheckCircle, CircleNotch, DownloadSimple, Warning } from "@phosphor-icons/react/ssr";
import Button from "@/components/ui/Button";
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
    <div className="space-y-4 py-6" role="status" aria-live="polite">
      <div className="flex items-center gap-3">
        <span className={cn("flex h-9 w-9 items-center justify-center rounded-lg ring-1 ring-inset", paused ? "bg-amber-50 text-amber-500 ring-amber-100" : "bg-indigo-50 text-indigo-600 ring-indigo-100")}>
          {paused ? <Warning className="h-5 w-5" weight="fill" /> : <CircleNotch className="h-5 w-5 animate-spin" weight="bold" />}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-semibold text-neutral-900">{paused ? "Import paused" : "Importing leads…"}</p>
          <p className="text-xs text-neutral-500 tabular-nums">
            {progress.processed.toLocaleString()} of {progress.total.toLocaleString()} rows processed ({pct}%)
          </p>
        </div>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-neutral-100">
        <div className={cn("h-full rounded-full transition-all duration-300", paused ? "bg-amber-400" : "bg-indigo-500")} style={{ width: `${pct}%` }} />
      </div>
      {error && <p className="text-[13px] text-rose-600">{error}</p>}
      {paused && (
        <div className="flex justify-end">
          <Button variant="primary" onClick={onRetry}>
            <ArrowClockwise className="h-4 w-4" weight="bold" />
            Retry — continue where it stopped
          </Button>
        </div>
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
      <div className="flex flex-col items-center py-2 text-center">
        <span
          className={cn(
            "mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-white shadow-[0_1px_2px_rgba(0,0,0,0.06),0_4px_12px_-2px_rgba(0,0,0,0.08)] ring-1 ring-neutral-200/80",
            interrupted ? "text-amber-500" : "text-emerald-500",
          )}
        >
          {interrupted ? <Warning className="h-6 w-6" weight="fill" /> : <CheckCircle className="h-6 w-6" weight="fill" />}
        </span>
        <p className="text-[15px] font-semibold tracking-tight text-neutral-900">{interrupted ? "Import incomplete" : "Import complete"}</p>
        <p className="mt-1 max-w-md text-[13px] text-neutral-500">
          {`${job.processedRows.toLocaleString()} of ${job.totalRows.toLocaleString()} rows processed. Safe to re-upload the same file — existing leads are matched, never duplicated.`}
        </p>
      </div>

      <div className="grid grid-cols-3 gap-px overflow-hidden rounded-lg bg-neutral-200/80 ring-1 ring-neutral-200/80 sm:grid-cols-5">
        {stats.map(([label, value, color]) => (
          <div key={label} className="bg-white px-3 py-2.5 text-center">
            <p className={cn("text-lg font-semibold tabular-nums tracking-tight", value === 0 ? "text-neutral-300" : color)}>{value.toLocaleString()}</p>
            <p className="mt-0.5 text-[11px] text-neutral-500">{label}</p>
          </div>
        ))}
      </div>
      {(job.risky > 0 || job.blocked > 0) && (
        <p className="text-center text-xs text-neutral-500">
          {job.risky > 0 && <>{job.risky} imported with a <b className="text-amber-600">risky</b> email (role/disposable). </>}
          {job.blocked > 0 && <>{job.blocked} imported but <b className="text-orange-600">blocked</b> (Do Not Contact).</>}
        </p>
      )}

      {report.length > 0 && (
        <div className="overflow-hidden rounded-lg ring-1 ring-inset ring-neutral-200">
          <div className="flex items-center justify-between gap-3 border-b border-neutral-200/80 bg-neutral-50/60 px-3 py-2">
            <span className="text-xs font-medium text-neutral-500">Row-level detail ({report.length.toLocaleString()})</span>
            <Button
              variant="secondary"
              size="xs"
              onClick={() => downloadCsv(`${fileName.replace(/\.csv$/i, "")}-import-issues.csv`, buildIssuesCsv(headers, rows, report))}
            >
              <DownloadSimple className="h-3.5 w-3.5" weight="bold" />
              Download issues as CSV
            </Button>
          </div>
          <ul className="max-h-40 divide-y divide-neutral-100 overflow-y-auto text-xs">
            {report.slice(0, 200).map((e, i) => (
              <li key={i} className="flex justify-between gap-3 px-3 py-1.5 text-neutral-500">
                <span className="shrink-0 tabular-nums text-neutral-400">Row {e.row}</span>
                <span className={cn("text-right", e.severity === "error" && "text-rose-600")}>{e.reason}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex justify-end border-t border-neutral-100 pt-4">
        <Button variant="primary" onClick={onDone}>Done</Button>
      </div>
    </div>
  );
}
