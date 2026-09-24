"use client";

import { useRef } from "react";
import { FileSpreadsheet, Table, Plug, Download, Upload } from "lucide-react";

export function ChooseStep({ onCsv }: { onCsv: () => void }) {
  return (
    <div className="space-y-3">
      <button
        onClick={onCsv}
        className="w-full flex items-start gap-3 rounded-xl border border-neutral-200 hover:border-indigo-300 hover:bg-indigo-50/40 p-4 text-left transition-colors"
      >
        <div className="w-9 h-9 rounded-lg bg-indigo-50 flex items-center justify-center shrink-0">
          <FileSpreadsheet className="w-4.5 h-4.5 text-indigo-600" />
        </div>
        <div>
          <p className="text-neutral-900 font-semibold text-sm">Excel / CSV</p>
          <p className="text-xs text-neutral-500 mt-0.5">Drag & drop or browse files</p>
        </div>
      </button>
      {[
        { icon: Table, title: "Google Sheets", note: "Live sync from a sheet URL · Coming soon" },
        { icon: Plug, title: "CRM Import", note: "Salesforce, HubSpot & more · Coming soon" },
      ].map(({ icon: Icon, title, note }) => (
        <div key={title} className="w-full flex items-start gap-3 rounded-xl border border-neutral-100 p-4 text-left opacity-50 cursor-not-allowed">
          <div className="w-9 h-9 rounded-lg bg-neutral-100 flex items-center justify-center shrink-0">
            <Icon className="w-4.5 h-4.5 text-neutral-400" />
          </div>
          <div>
            <p className="text-neutral-900 font-semibold text-sm">{title}</p>
            <p className="text-xs text-neutral-500 mt-0.5">{note}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

export function UploadStep({ onFile, error, maxRows }: { onFile: (f: File) => void; error: string | null; maxRows: number }) {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-4">
        <p className="text-sm text-neutral-900 font-semibold mb-1">1. Use our template (optional)</p>
        <p className="text-xs text-neutral-500 mb-3">
          Any CSV with a header row works — we match common column names automatically (First Name, E-mail, Organization, Website, Title…).
        </p>
        <a
          href="/leads-template.csv"
          download
          className="inline-flex items-center gap-2 text-sm text-neutral-700 bg-white border border-neutral-200 rounded-lg px-3 py-1.5 hover:bg-neutral-50 hover:border-neutral-300 transition-colors"
        >
          <Download className="w-4 h-4" />
          Download template
        </a>
      </div>
      <div>
        <p className="text-sm text-neutral-900 font-semibold mb-3">2. Upload your file</p>
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            const file = e.dataTransfer.files?.[0];
            if (file) onFile(file);
          }}
          onClick={() => inputRef.current?.click()}
          className="cursor-pointer rounded-xl border border-dashed border-neutral-300 hover:border-indigo-300 hover:bg-indigo-50/30 transition-colors p-10 flex flex-col items-center justify-center text-center"
        >
          <Upload className="w-8 h-8 text-neutral-400 mb-3" />
          <p className="text-sm text-neutral-900 font-medium">Drag & drop your CSV here</p>
          <p className="text-xs text-neutral-500 mt-1">or click to browse · up to {maxRows.toLocaleString()} rows per import</p>
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
      </div>
      {error && <p className="text-sm text-rose-600 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">{error}</p>}
    </div>
  );
}
