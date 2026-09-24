"use client";

import { ArrowLeft, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { FIELD_LABELS, type HeaderMapping } from "@/lib/domain/leads/import/headers";
import { IMPORT_FIELDS, type ImportField } from "@/lib/domain/leads/validate";
import type { RawRow } from "@/lib/domain/leads/import/preview";

export default function MapStep({
  fileName, headers, rows, mapping, onChange, canContinue, onContinue,
}: {
  fileName: string;
  headers: string[];
  rows: RawRow[];
  mapping: HeaderMapping;
  onChange: (m: HeaderMapping) => void;
  canContinue: boolean;
  onContinue: () => void;
}) {
  const duplicates = IMPORT_FIELDS.filter((f) => Object.values(mapping).filter((v) => v === f).length > 1);
  return (
    <div className="space-y-5">
      <p className="text-sm text-neutral-500">
        <span className="text-neutral-900 font-medium">{fileName}</span> · {rows.length.toLocaleString()} rows detected. We matched your columns automatically —
        check them, and change anything that&apos;s wrong.
      </p>

      <div className="space-y-2">
        {headers.map((header) => {
          const sample = rows.find((r) => r[header]?.trim())?.[header]?.trim();
          return (
            <div key={header} className="flex items-center gap-3 rounded-lg border border-neutral-200 px-3 py-2">
              <div className="flex-1 min-w-0">
                <p className="text-sm text-neutral-700 truncate">{header}</p>
                {sample && <p className="text-[11px] text-neutral-400 truncate">e.g. {sample}</p>}
              </div>
              <ArrowLeft className="w-3.5 h-3.5 text-neutral-300 rotate-180 shrink-0" />
              <select
                aria-label={`Map column ${header}`}
                value={mapping[header] ?? ""}
                onChange={(e) => onChange({ ...mapping, [header]: e.target.value as ImportField | "" })}
                className={cn(
                  "bg-neutral-50 border rounded-lg text-sm text-neutral-900 px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-300",
                  mapping[header] ? "border-indigo-300" : "border-neutral-200",
                )}
              >
                <option value="">Ignore column</option>
                {IMPORT_FIELDS.map((f) => (
                  <option key={f} value={f}>{FIELD_LABELS[f]}</option>
                ))}
              </select>
            </div>
          );
        })}
      </div>

      {duplicates.length > 0 && (
        <p className="flex items-start gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-px" />
          More than one column is mapped to {duplicates.map((f) => FIELD_LABELS[f]).join(", ")}. The first non-empty value in each row is used.
        </p>
      )}
      {!canContinue && (
        <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          Map a &quot;Full name&quot; column (or &quot;First name&quot; / &quot;Last name&quot;) to continue.
        </p>
      )}

      <button
        onClick={onContinue}
        disabled={!canContinue}
        className={cn(
          "w-full rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors",
          canContinue ? "bg-neutral-900 text-white hover:bg-neutral-800" : "bg-neutral-100 text-neutral-400 cursor-not-allowed",
        )}
      >
        Continue to preview
      </button>
    </div>
  );
}
