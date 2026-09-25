"use client";

import { useRef, useState } from "react";
import { CaretRight, CloudArrowUp, DownloadSimple, FileCsv, GoogleDriveLogo, Plug, WarningOctagon } from "@phosphor-icons/react/ssr";
import { buttonClasses } from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import { cn } from "@/lib/utils";

export function ChooseStep({ onCsv }: { onCsv: () => void }) {
  return (
    <div className="space-y-2">
      <button
        onClick={onCsv}
        className="group flex w-full items-center gap-3 rounded-xl bg-white p-3.5 text-left ring-1 ring-inset ring-neutral-200 shadow-[0_1px_2px_rgba(0,0,0,0.03)] transition-all hover:ring-indigo-300 hover:shadow-[0_2px_8px_-2px_rgba(79,70,229,0.18)]"
      >
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 ring-1 ring-inset ring-emerald-100">
          <FileCsv className="h-5 w-5" weight="duotone" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[13px] font-semibold text-neutral-900">Excel / CSV</span>
          <span className="mt-0.5 block text-xs text-neutral-500">Drag & drop or browse files</span>
        </span>
        <CaretRight className="h-4 w-4 text-neutral-300 transition-transform group-hover:translate-x-0.5 group-hover:text-indigo-500" weight="bold" />
      </button>
      {[
        { icon: GoogleDriveLogo, title: "Google Sheets", note: "Live sync from a sheet URL" },
        { icon: Plug, title: "CRM Import", note: "Salesforce, HubSpot & more" },
      ].map(({ icon: Icon, title, note }) => (
        <div key={title} aria-disabled className="flex w-full cursor-not-allowed items-center gap-3 rounded-xl p-3.5 text-left ring-1 ring-inset ring-neutral-100">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-neutral-50 text-neutral-400 ring-1 ring-inset ring-neutral-100">
            <Icon className="h-5 w-5" weight="duotone" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[13px] font-semibold text-neutral-500">{title}</span>
            <span className="mt-0.5 block text-xs text-neutral-400">{note}</span>
          </span>
          <Badge tone="neutral">Coming soon</Badge>
        </div>
      ))}
    </div>
  );
}

export function UploadStep({ onFile, error, maxRows }: { onFile: (f: File) => void; error: string | null; maxRows: number }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  return (
    <div className="space-y-4">
      <div
        role="button"
        tabIndex={0}
        onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); if (!over) setOver(true); }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          const file = e.dataTransfer.files?.[0];
          if (file) onFile(file);
        }}
        onClick={() => inputRef.current?.click()}
        className={cn(
          "flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-12 text-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/40",
          over ? "border-indigo-400 bg-indigo-50/60" : "border-neutral-200 bg-neutral-50/50 hover:border-indigo-300 hover:bg-indigo-50/30",
        )}
      >
        <span className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-white text-indigo-600 shadow-[0_1px_2px_rgba(0,0,0,0.06),0_4px_12px_-2px_rgba(79,70,229,0.18)] ring-1 ring-neutral-200/80">
          <CloudArrowUp className="h-6 w-6" weight="duotone" />
        </span>
        <p className="text-[13px] font-medium text-neutral-900">
          Drag & drop your CSV here <span className="font-normal text-neutral-500">or</span> <span className="text-indigo-600">browse</span>
        </p>
        <p className="mt-1 text-xs text-neutral-500">Up to {maxRows.toLocaleString()} rows per import</p>
        <input
          ref={inputRef}
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) onFile(file);
          }}
        />
      </div>

      {error && (
        <p className="flex items-start gap-2 rounded-lg bg-rose-50 px-3 py-2 text-[13px] text-rose-700 ring-1 ring-inset ring-rose-200">
          <WarningOctagon className="mt-0.5 h-4 w-4 shrink-0" weight="fill" />
          {error}
        </p>
      )}

      <div className="flex items-center gap-3 rounded-lg bg-neutral-50 px-3.5 py-3 ring-1 ring-inset ring-neutral-200/70">
        <FileCsv className="h-5 w-5 shrink-0 text-neutral-400" weight="duotone" />
        <p className="min-w-0 flex-1 text-xs leading-relaxed text-neutral-500">
          <span className="font-medium text-neutral-800">Template optional.</span> Any CSV with a header row works — we match common column names automatically (First Name, E-mail, Organization, Website, Title…).
        </p>
        <a href="/leads-template.csv" download className={buttonClasses({ variant: "secondary", size: "xs" })}>
          <DownloadSimple className="h-3.5 w-3.5" weight="bold" />
          Download template
        </a>
      </div>
    </div>
  );
}
