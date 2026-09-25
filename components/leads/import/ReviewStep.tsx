"use client";

import { CaretRight, CircleNotch, Prohibit, UploadSimple } from "@phosphor-icons/react/ssr";
import Button from "@/components/ui/Button";
import Checkbox from "@/components/ui/Checkbox";
import { TONE } from "@/components/ui/Badge";
import { cn } from "@/lib/utils";
import type { LeadIssue } from "@/lib/domain/leads/validate";
import type { ExistingClassification, ImportOptions, PreviewResult, PreviewRow } from "@/lib/domain/leads/import/preview";

const PREVIEW_ROWS = 20;

const STATUS_STYLE: Record<PreviewRow["status"], { label: string; cls: string }> = {
  new: { label: "New", cls: TONE.emerald.badge },
  duplicate_in_file: { label: "Duplicate in file", cls: TONE.neutral.badge },
  invalid: { label: "Invalid", cls: TONE.rose.badge },
};

function Stat({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="bg-white px-3 py-2.5">
      <p className={cn("text-lg font-semibold tabular-nums tracking-tight", value === 0 ? "text-neutral-300" : tone)}>{value.toLocaleString()}</p>
      <p className="mt-0.5 text-[11px] text-neutral-500">{label}</p>
    </div>
  );
}

function IssueChips({ issues }: { issues: LeadIssue[] }) {
  if (issues.length === 0) return <span className="text-neutral-300">—</span>;
  return (
    <div className="flex flex-wrap gap-1">
      {issues.map((i, k) => (
        <span
          key={k}
          title={i.message}
          className={cn(
            "inline-flex h-[18px] items-center whitespace-nowrap rounded px-1 text-[10px] font-medium ring-1 ring-inset",
            i.severity === "error" ? TONE.rose.badge : TONE.amber.badge,
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
      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-lg bg-neutral-200/80 ring-1 ring-neutral-200/80 sm:grid-cols-4">
        <Stat label="Will be created" value={classification.new} tone="text-emerald-600" />
        <Stat label="Already in workspace" value={classification.existing} tone="text-indigo-600" />
        <Stat label="Duplicates in file" value={s.duplicateInFile} tone="text-neutral-600" />
        <Stat label="Invalid (skipped)" value={s.invalid} tone="text-rose-600" />
        <Stat label="Role accounts (risky)" value={s.roleAccounts} tone="text-amber-600" />
        <Stat label="Disposable (risky)" value={s.disposable} tone="text-amber-600" />
        <Stat label="No email" value={s.missingEmail} tone="text-neutral-600" />
        <Stat label="On Do Not Contact" value={classification.blocked} tone="text-orange-600" />
      </div>
      {classification.blocked > 0 && (
        <p className="flex items-start gap-2 rounded-lg bg-orange-50 px-3 py-2 text-xs text-orange-800 ring-1 ring-inset ring-orange-200/70">
          <Prohibit className="mt-px h-3.5 w-3.5 shrink-0 text-orange-500" weight="bold" />
          <span>
          {classification.blocked} row{classification.blocked === 1 ? " is" : "s are"} on your Do Not Contact list. They&apos;re imported (nothing is silently dropped) but flagged
          <b> blocked</b>, and can never be enrolled in a campaign.</span>
        </p>
      )}

      <fieldset>
        <legend className="mb-2 text-xs font-medium text-neutral-500">If a lead already exists</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {(
            [
              ["skip", "Skip existing leads", "Leave them exactly as they are."],
              ["update_blank", "Fill blank fields only", "Add missing details (phone, title, company…). Existing values are never overwritten."],
            ] as const
          ).map(([value, title, hint]) => (
            <label
              key={value}
              className={cn(
                "flex cursor-pointer items-start gap-2.5 rounded-lg p-3 ring-1 ring-inset transition-colors",
                options.existing === value ? "bg-indigo-50/50 ring-indigo-300" : "ring-neutral-200 hover:ring-neutral-300",
              )}
            >
              <input
                type="radio"
                name="existing"
                checked={options.existing === value}
                onChange={() => onOptions({ ...options, existing: value })}
                className="mt-0.5 accent-indigo-600"
              />
              <span>
                <span className="block text-[13px] font-medium text-neutral-900">{title}</span>
                <span className="mt-0.5 block text-xs text-neutral-500">{hint}</span>
              </span>
            </label>
          ))}
        </div>
        <label className="mt-3 flex cursor-pointer items-start gap-2.5">
          <Checkbox checked={options.checkMx} onChange={(e) => onOptions({ ...options, checkMx: e.target.checked })} className="mt-0.5" />
          <span>
            <span className="block text-[13px] text-neutral-900">Check that email domains can receive mail</span>
            <span className="block text-xs text-neutral-500">Slower. Marks addresses on domains with no mail server as invalid. Doesn&apos;t verify individual mailboxes.</span>
          </span>
        </label>
      </fieldset>

      <div>
        <p className="mb-2 text-xs font-medium text-neutral-500">Preview — first {Math.min(PREVIEW_ROWS, preview.mapped.length)} of {preview.mapped.length.toLocaleString()} rows</p>
        <div className="overflow-x-auto rounded-lg ring-1 ring-inset ring-neutral-200">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-neutral-200/80 bg-neutral-50/60 text-left text-neutral-500">
                {["Row", "Name", "Email", "Company", "Title", "Result", "Flags"].map((h) => (
                  <th key={h} className="whitespace-nowrap px-2.5 py-2 font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {preview.mapped.slice(0, PREVIEW_ROWS).map((r) => {
                const st = STATUS_STYLE[r.status];
                return (
                  <tr key={r.row} className="text-neutral-700 transition-colors hover:bg-neutral-50/80">
                    <td className="px-2.5 py-1.5 text-neutral-400 tabular-nums">{r.row}</td>
                    <td className="px-2.5 py-1.5 whitespace-nowrap">{r.lead?.fullName ?? <span className="text-neutral-300">—</span>}</td>
                    <td className="px-2.5 py-1.5">{r.lead?.email ?? r.input.email ?? <span className="text-neutral-300">—</span>}</td>
                    <td className="px-2.5 py-1.5 whitespace-nowrap">
                      {r.lead?.company ?? <span className="text-neutral-300">—</span>}
                      {r.lead?.companyDomain && <span className="text-neutral-400"> · {r.lead.companyDomain}</span>}
                    </td>
                    <td className="px-2.5 py-1.5 whitespace-nowrap">{r.lead?.jobTitle ?? <span className="text-neutral-300">—</span>}</td>
                    <td className="px-2.5 py-1.5"><span className={cn("inline-flex h-5 items-center whitespace-nowrap rounded-md px-1.5 text-[11px] font-medium ring-1 ring-inset", st.cls)}>{st.label}</span></td>
                    <td className="px-2.5 py-1.5"><IssueChips issues={r.issues} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {problems.length > 0 && (
        <details className="group rounded-lg bg-neutral-50/60 ring-1 ring-inset ring-neutral-200">
          <summary className="flex cursor-pointer list-none items-center gap-1.5 px-3 py-2 text-xs text-neutral-600 hover:text-neutral-900 [&::-webkit-details-marker]:hidden">
            <CaretRight className="h-3 w-3 text-neutral-400 transition-transform group-open:rotate-90" weight="bold" />
            <span>{preview.errors.length.toLocaleString()} row{preview.errors.length === 1 ? "" : "s"} won&apos;t be imported — show reasons</span>
          </summary>
          <ul className="max-h-40 divide-y divide-neutral-100 overflow-y-auto border-t border-neutral-200 text-xs">
            {problems.map((p, i) => (
              <li key={i} className="px-3 py-1.5 flex justify-between gap-3 text-neutral-500">
                <span className="text-neutral-400 shrink-0">Row {p.row}</span>
                <span className="text-right">{p.message}</span>
              </li>
            ))}
          </ul>
        </details>
      )}

      <div className="flex justify-end border-t border-neutral-100 pt-4">
        <Button variant="primary" size="md" onClick={onImport} disabled={checking || nothingToDo}>
          {checking ? <CircleNotch className="h-4 w-4 animate-spin" weight="bold" /> : !nothingToDo && <UploadSimple className="h-4 w-4" weight="bold" />}
          {checking
            ? "Checking for existing leads…"
            : nothingToDo
              ? "Nothing to import"
              : `Import ${classification.new.toLocaleString()} new lead${classification.new === 1 ? "" : "s"}${
                  options.existing === "update_blank" && classification.existing > 0 ? ` + update ${classification.existing.toLocaleString()} existing` : ""
                }`}
        </Button>
      </div>
    </div>
  );
}
