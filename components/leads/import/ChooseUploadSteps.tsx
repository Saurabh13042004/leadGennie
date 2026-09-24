"use client";

import { useRef } from "react";
import { FileSpreadsheet, Table, Plug, Download, Upload } from "lucide-react";

export function ChooseStep({ onCsv }: { onCsv: () => void }) {
  return (
    <div className="space-y-3">
      <button
        onClick={onCsv}
        className="w-full flex items-start gap-3 rounded-xl border border-white/10 hover:border-white/20 hover:bg-white/5 p-4 text-left transition-colors"
      >
        <FileSpreadsheet className="w-5 h-5 text-blue-400 mt-0.5 shrink-0" />
        <div>
          <p className="text-white font-medium text-sm">Excel / CSV</p>
          <p className="text-xs text-neutral-500 mt-0.5">Drag & drop or browse files</p>
        </div>
      </button>
      {[
        { icon: Table, title: "Google Sheets", note: "Live sync from a sheet URL · Coming soon" },
        { icon: Plug, title: "CRM Import", note: "Salesforce, HubSpot & more · Coming soon" },
      ].map(({ icon: Icon, title, note }) => (
        <div key={title} className="w-full flex items-start gap-3 rounded-xl border border-white/5 p-4 text-left opacity-50 cursor-not-allowed">
          <Icon className="w-5 h-5 text-neutral-500 mt-0.5 shrink-0" />
          <div>
            <p className="text-white font-medium text-sm">{title}</p>
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
      <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
        <p className="text-sm text-white font-medium mb-1">1. Use our template (optional)</p>
        <p className="text-xs text-neutral-500 mb-3">
          Any CSV with a header row works — we match common column names automatically (First Name, E-mail, Organization, Website, Title…).
        </p>
        <a
          href="/leads-template.csv"
          download
          className="inline-flex items-center gap-2 text-sm text-white border border-white/10 rounded-lg px-3 py-1.5 hover:bg-white/5 transition-colors"
        >
          <Download className="w-4 h-4" />
          Download template
        </a>
      </div>
      <div>
        <p className="text-sm text-white font-medium mb-3">2. Upload your file</p>
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            const file = e.dataTransfer.files?.[0];
            if (file) onFile(file);
          }}
          onClick={() => inputRef.current?.click()}
          className="cursor-pointer rounded-xl border border-dashed border-white/15 hover:border-white/30 hover:bg-white/[0.02] transition-colors p-10 flex flex-col items-center justify-center text-center"
        >
          <Upload className="w-8 h-8 text-neutral-500 mb-3" />
          <p className="text-sm text-white">Drag & drop your CSV here</p>
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
      {error && <p className="text-sm text-red-400">{error}</p>}
    </div>
  );
}
