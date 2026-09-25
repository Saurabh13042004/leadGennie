"use client";

import { ArrowRight, CheckCircle, FileCsv, Warning } from "@phosphor-icons/react/ssr";
import { FIELD_LABELS, type HeaderMapping } from "@/lib/domain/leads/import/headers";
import { IMPORT_FIELDS, type ImportField } from "@/lib/domain/leads/validate";
import type { RawRow } from "@/lib/domain/leads/import/preview";
import Button from "@/components/ui/Button";
import { Select } from "@/components/ui/Field";

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
  const mappedCount = headers.filter((h) => mapping[h]).length;
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 ring-1 ring-inset ring-emerald-100">
          <FileCsv className="h-5 w-5" weight="duotone" />
        </span>
        <div className="min-w-0">
          <p className="truncate text-[13px] font-medium text-neutral-900">{fileName}</p>
          <p className="text-xs text-neutral-500">
            {rows.length.toLocaleString()} rows detected. We matched your columns automatically — check them, and change anything that&apos;s wrong.
          </p>
        </div>
      </div>

      <div className="overflow-hidden rounded-lg ring-1 ring-inset ring-neutral-200">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="border-b border-neutral-200/80 bg-neutral-50/60 text-left text-xs text-neutral-500">
              <th className="px-3 py-2 font-medium">Column in your file</th>
              <th className="w-8" aria-hidden />
              <th className="px-3 py-2 font-medium">
                LeadGennie field <span className="font-normal text-neutral-400">· {mappedCount} of {headers.length} mapped</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {headers.map((header) => {
              const sample = rows.find((r) => r[header]?.trim())?.[header]?.trim();
              const mapped = !!mapping[header];
              return (
                <tr key={header} className="align-middle">
                  <td className="max-w-0 px-3 py-2">
                    <p className="truncate font-medium text-neutral-800">{header}</p>
                    {sample && <p className="truncate text-[11px] text-neutral-400">e.g. {sample}</p>}
                  </td>
                  <td className="w-8 text-center">
                    <ArrowRight className="mx-auto h-3.5 w-3.5 text-neutral-300" weight="bold" />
                  </td>
                  <td className="w-[46%] px-3 py-2">
                    <div className="flex items-center gap-2">
                      <Select
                        aria-label={`Map column ${header}`}
                        value={mapping[header] ?? ""}
                        onChange={(e) => onChange({ ...mapping, [header]: e.target.value as ImportField | "" })}
                        className="min-w-0 flex-1"
                      >
                        <option value="">Ignore column</option>
                        {IMPORT_FIELDS.map((f) => (
                          <option key={f} value={f}>{FIELD_LABELS[f]}</option>
                        ))}
                      </Select>
                      {mapped ? (
                        <CheckCircle className="h-4 w-4 shrink-0 text-indigo-500" weight="fill" aria-label="Mapped" />
                      ) : (
                        <span className="h-4 w-4 shrink-0 rounded-full ring-1 ring-inset ring-neutral-200" aria-label="Ignored" />
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {duplicates.length > 0 && (
        <p className="flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800 ring-1 ring-inset ring-amber-200/70">
          <Warning className="mt-px h-4 w-4 shrink-0 text-amber-500" weight="fill" />
          More than one column is mapped to {duplicates.map((f) => FIELD_LABELS[f]).join(", ")}. The first non-empty value in each row is used.
        </p>
      )}

      <div className="flex flex-wrap items-center justify-end gap-3 border-t border-neutral-100 pt-4">
        {!canContinue && (
          <p className="mr-auto flex items-center gap-1.5 text-xs text-amber-700">
            <Warning className="h-3.5 w-3.5 text-amber-500" weight="fill" />
            Map a &quot;Full name&quot; column (or &quot;First name&quot; / &quot;Last name&quot;) to continue.
          </p>
        )}
        <Button variant="primary" onClick={onContinue} disabled={!canContinue}>
          Continue to preview
          <ArrowRight className="h-4 w-4" weight="bold" />
        </Button>
      </div>
    </div>
  );
}
