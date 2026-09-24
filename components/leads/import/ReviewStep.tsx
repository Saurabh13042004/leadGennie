"use client";

import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { LeadIssue } from "@/lib/domain/leads/validate";
import type { ExistingClassification, ImportOptions, PreviewResult, PreviewRow } from "@/lib/domain/leads/import/preview";

const PREVIEW_ROWS = 20;

const STATUS_STYLE: Record<PreviewRow["status"], { label: string; cls: string }> = {
  new: { label: "New", cls: "bg-green-500/10 text-green-300 border-green-500/20" },
  duplicate_in_file: { label: "Duplicate in file", cls: "bg-neutral-500/10 text-neutral-300 border-white/10" },
  invalid: { label: "Invalid", cls: "bg-red-500/10 text-red-300 border-red-500/20" },
};

function Stat({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.02] py-2.5 text-center">
      <p className={cn("text-lg font-semibold tabular-nums", tone)}>{value.toLocaleString()}</p>
      <p className="text-[11px] text-neutral-500 mt-0.5 px-1">{label}</p>
    </div>
  );
}

function IssueChips({ issues }: { issues: LeadIssue[] }) {
  if (issues.length === 0) return <span className="text-neutral-700">—</span>;
  return (
    <div className="flex flex-wrap gap-1">
      {issues.map((i, k) => (
        <span
          key={k}
          title={i.message}
          className={cn(
            "text-[10px] rounded px-1.5 py-0.5 border",
            i.severity === "error" ? "border-red-500/30 text-red-300 bg-red-500/10" : "border-yellow-500/30 text-yellow-200 bg-yellow-500/10",
          )}
        >
          {i.code.replace(/_/g, " ")}
        </span>
      ))}
    </div>
  );
}

export default function ReviewStep({
  preview, classification, checking, options, onOptions, onImport,
}: {
  preview: PreviewResult;
  classification: ExistingClassification;
  checking: boolean;
  options: ImportOptions;
  onOptions: (o: ImportOptions) => void;
  onImport: () => void;
}) {
  const s = preview.summary;
  const problems = preview.errors.slice(0, 50);
  const nothingToDo = classification.new === 0 && (classification.existing === 0 || options.existing === "skip");

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <Stat label="Will be created" value={classification.new} tone="text-green-400" />
        <Stat label="Already in workspace" value={classification.existing} tone="text-blue-400" />
        <Stat label="Duplicates in file" value={s.duplicateInFile} tone="text-neutral-300" />
        <Stat label="Invalid (skipped)" value={s.invalid} tone="text-red-400" />
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <Stat label="Role accounts (risky)" value={s.roleAccounts} tone="text-yellow-300" />
        <Stat label="Disposable (risky)" value={s.disposable} tone="text-yellow-300" />
        <Stat label="No email" value={s.missingEmail} tone="text-neutral-300" />
        <Stat label="On Do Not Contact" value={classification.blocked} tone="text-orange-300" />
      </div>
      {classification.blocked > 0 && (
        <p className="text-xs text-orange-200 bg-orange-500/10 border border-orange-500/20 rounded-lg px-3 py-2">
          {classification.blocked} row{classification.blocked === 1 ? " is" : "s are"} on your Do Not Contact list. They&apos;re imported (nothing is silently dropped) but flagged
          <b> blocked</b>, and can never be enrolled in a campaign.
        </p>
      )}

      <fieldset className="rounded-lg border border-white/10 p-3 space-y-2">
        <legend className="px-1 text-xs text-neutral-500">If a lead already exists</legend>
        {(
          [
            ["skip", "Skip existing leads", "Leave them exactly as they are."],
            ["update_blank", "Fill blank fields only", "Add missing details (phone, title, company…). Existing values are never overwritten."],
          ] as const
        ).map(([value, title, hint]) => (
          <label key={value} className="flex items-start gap-2 cursor-pointer">
            <input
              type="radio"
              name="existing"
              checked={options.existing === value}
              onChange={() => onOptions({ ...options, existing: value })}
              className="mt-1"
            />
            <span>
              <span className="text-sm text-white">{title}</span>
              <span className="block text-xs text-neutral-500">{hint}</span>
            </span>
          </label>
        ))}
        <label className="flex items-start gap-2 cursor-pointer pt-2 border-t border-white/5">
          <input type="checkbox" checked={options.checkMx} onChange={(e) => onOptions({ ...options, checkMx: e.target.checked })} className="mt-1" />
          <span>
            <span className="text-sm text-white">Check that email domains can receive mail</span>
            <span className="block text-xs text-neutral-500">Slower. Marks addresses on domains with no mail server as invalid. Doesn&apos;t verify individual mailboxes.</span>
          </span>
        </label>
      </fieldset>

      <div>
        <p className="text-xs text-neutral-500 mb-2">Preview — first {Math.min(PREVIEW_ROWS, preview.mapped.length)} of {preview.mapped.length.toLocaleString()} rows</p>
        <div className="rounded-lg border border-white/10 overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-neutral-500 border-b border-white/10">
                {["Row", "Name", "Email", "Company", "Title", "Result", "Flags"].map((h) => (
                  <th key={h} className="px-2.5 py-2 font-medium whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {preview.mapped.slice(0, PREVIEW_ROWS).map((r) => {
                const st = STATUS_STYLE[r.status];
                return (
                  <tr key={r.row} className="border-b border-white/5 last:border-0 text-neutral-300">
                    <td className="px-2.5 py-1.5 text-neutral-600 tabular-nums">{r.row}</td>
                    <td className="px-2.5 py-1.5 whitespace-nowrap">{r.lead?.fullName ?? <span className="text-neutral-600">—</span>}</td>
                    <td className="px-2.5 py-1.5">{r.lead?.email ?? r.input.email ?? <span className="text-neutral-600">—</span>}</td>
                    <td className="px-2.5 py-1.5 whitespace-nowrap">
                      {r.lead?.company ?? <span className="text-neutral-600">—</span>}
                      {r.lead?.companyDomain && <span className="text-neutral-600"> · {r.lead.companyDomain}</span>}
                    </td>
                    <td className="px-2.5 py-1.5 whitespace-nowrap">{r.lead?.jobTitle ?? <span className="text-neutral-600">—</span>}</td>
                    <td className="px-2.5 py-1.5"><span className={cn("border rounded-full px-2 py-0.5 whitespace-nowrap", st.cls)}>{st.label}</span></td>
                    <td className="px-2.5 py-1.5"><IssueChips issues={r.issues} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {problems.length > 0 && (
        <details className="rounded-lg border border-white/10 bg-white/[0.02]">
          <summary className="px-3 py-2 text-xs text-neutral-400 cursor-pointer">
            {preview.errors.length.toLocaleString()} row{preview.errors.length === 1 ? "" : "s"} won&apos;t be imported — show reasons
          </summary>
          <ul className="max-h-40 overflow-y-auto text-xs divide-y divide-white/5">
            {problems.map((p, i) => (
              <li key={i} className="px-3 py-1.5 flex justify-between gap-3 text-neutral-400">
                <span className="text-neutral-500 shrink-0">Row {p.row}</span>
                <span className="text-right">{p.message}</span>
              </li>
            ))}
          </ul>
        </details>
      )}

      <button
        onClick={onImport}
        disabled={checking || nothingToDo}
        className={cn(
          "w-full flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition-colors",
          checking || nothingToDo ? "bg-white/10 text-neutral-500 cursor-not-allowed" : "bg-white text-black hover:bg-neutral-200",
        )}
      >
        {checking && <Loader2 className="w-4 h-4 animate-spin" />}
        {checking
          ? "Checking for existing leads…"
          : nothingToDo
            ? "Nothing to import"
            : `Import ${classification.new.toLocaleString()} new lead${classification.new === 1 ? "" : "s"}${
                options.existing === "update_blank" && classification.existing > 0 ? ` + update ${classification.existing.toLocaleString()} existing` : ""
              }`}
      </button>
    </div>
  );
}
