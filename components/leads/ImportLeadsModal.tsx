"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Papa from "papaparse";
import {
  X,
  FileSpreadsheet,
  Table,
  Plug,
  Download,
  Upload,
  Loader2,
  CheckCircle2,
  ArrowLeft,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { importLeadsCsv, type ImportRow } from "@/lib/actions/leads";

const FIELDS: { key: keyof ImportRow; label: string; required?: boolean }[] = [
  { key: "full_name", label: "Full name", required: true },
  { key: "email", label: "Email" },
  { key: "company", label: "Company" },
  { key: "job_title", label: "Job title" },
  { key: "linkedin_url", label: "LinkedIn URL" },
];

function guessField(header: string): keyof ImportRow | "" {
  const h = header.toLowerCase().replace(/[\s_-]/g, "");
  if (h.includes("name")) return "full_name";
  if (h.includes("email")) return "email";
  if (h.includes("company") || h.includes("organization") || h.includes("org")) return "company";
  if (h.includes("title") || h.includes("role") || h.includes("position")) return "job_title";
  if (h.includes("linkedin")) return "linkedin_url";
  return "";
}

type Step = "choose" | "upload" | "map" | "done";

export default function ImportLeadsModal({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [step, setStep] = useState<Step>("choose");
  const [fileName, setFileName] = useState("");
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [importing, setImporting] = useState(false);
  const [importedCount, setImportedCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleFile(file: File) {
    setError(null);
    setFileName(file.name);
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const parsedHeaders = results.meta.fields ?? [];
        setHeaders(parsedHeaders);
        setRows(results.data.slice(0, 500));

        const initialMapping: Record<string, string> = {};
        for (const h of parsedHeaders) {
          const guess = guessField(h);
          if (guess) initialMapping[h] = guess;
        }
        setMapping(initialMapping);
        setStep("map");
      },
      error: (err) => setError(err.message),
    });
  }

  async function handleConfirmImport() {
    setImporting(true);
    setError(null);

    const mappedRows: ImportRow[] = rows.map((row) => {
      const mapped: ImportRow = { full_name: "" };
      for (const [header, field] of Object.entries(mapping)) {
        if (!field) continue;
        (mapped as Record<string, string>)[field] = row[header] ?? "";
      }
      return mapped;
    });

    try {
      const result = await importLeadsCsv(mappedRows);
      setImportedCount(result.imported);
      setStep("done");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Import failed");
    } finally {
      setImporting(false);
    }
  }

  const hasFullNameMapped = Object.values(mapping).includes("full_name");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />

      <div className="relative w-full max-w-2xl max-h-[85vh] overflow-y-auto rounded-2xl border border-white/10 bg-[#0A0A0A] shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 sticky top-0 bg-[#0A0A0A] z-10">
          <div className="flex items-center gap-2">
            {step !== "choose" && step !== "done" && (
              <button
                onClick={() => setStep(step === "map" ? "upload" : "choose")}
                className="text-neutral-500 hover:text-white"
                aria-label="Back"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
            )}
            <h2 className="text-white font-semibold">Import leads</h2>
          </div>
          <button onClick={onClose} className="text-neutral-500 hover:text-white" aria-label="Close">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6">
          {step === "choose" && (
            <div className="space-y-3">
              <button
                onClick={() => setStep("upload")}
                className="w-full flex items-start gap-3 rounded-xl border border-white/10 hover:border-white/20 hover:bg-white/5 p-4 text-left transition-colors"
              >
                <FileSpreadsheet className="w-5 h-5 text-blue-400 mt-0.5 shrink-0" />
                <div>
                  <p className="text-white font-medium text-sm">Excel / CSV</p>
                  <p className="text-xs text-neutral-500 mt-0.5">Drag & drop or browse files</p>
                </div>
              </button>

              <div className="w-full flex items-start gap-3 rounded-xl border border-white/5 p-4 text-left opacity-50 cursor-not-allowed">
                <Table className="w-5 h-5 text-neutral-500 mt-0.5 shrink-0" />
                <div>
                  <p className="text-white font-medium text-sm">Google Sheets</p>
                  <p className="text-xs text-neutral-500 mt-0.5">Live sync from a sheet URL · Coming soon</p>
                </div>
              </div>

              <div className="w-full flex items-start gap-3 rounded-xl border border-white/5 p-4 text-left opacity-50 cursor-not-allowed">
                <Plug className="w-5 h-5 text-neutral-500 mt-0.5 shrink-0" />
                <div>
                  <p className="text-white font-medium text-sm">CRM Import</p>
                  <p className="text-xs text-neutral-500 mt-0.5">Salesforce, HubSpot & more · Coming soon</p>
                </div>
              </div>
            </div>
          )}

          {step === "upload" && (
            <div className="space-y-5">
              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                <p className="text-sm text-white font-medium mb-1">1. Use our template</p>
                <p className="text-xs text-neutral-500 mb-3">
                  Download the CSV format we expect: full_name, email, company, job_title, linkedin_url.
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
                    if (file) handleFile(file);
                  }}
                  onClick={() => fileInputRef.current?.click()}
                  className="cursor-pointer rounded-xl border border-dashed border-white/15 hover:border-white/30 hover:bg-white/[0.02] transition-colors p-10 flex flex-col items-center justify-center text-center"
                >
                  <Upload className="w-8 h-8 text-neutral-500 mb-3" />
                  <p className="text-sm text-white">Drag & drop your CSV here</p>
                  <p className="text-xs text-neutral-500 mt-1">or click to browse files</p>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleFile(file);
                    }}
                  />
                </div>
              </div>
              {error && <p className="text-sm text-red-400">{error}</p>}
            </div>
          )}

          {step === "map" && (
            <div className="space-y-5">
              <p className="text-sm text-neutral-400">
                <span className="text-white">{fileName}</span> · {rows.length} rows detected. Map your columns to
                LeadGennie fields.
              </p>

              <div className="space-y-2">
                {headers.map((header) => (
                  <div key={header} className="flex items-center gap-3 rounded-lg border border-white/10 px-3 py-2">
                    <span className="text-sm text-neutral-300 flex-1 truncate">{header}</span>
                    <ArrowLeft className="w-3.5 h-3.5 text-neutral-600 rotate-180 shrink-0" />
                    <select
                      value={mapping[header] ?? ""}
                      onChange={(e) => setMapping((m) => ({ ...m, [header]: e.target.value }))}
                      className="bg-white/5 border border-white/10 rounded-lg text-sm text-white px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-white/20"
                    >
                      <option value="">Ignore column</option>
                      {FIELDS.map((f) => (
                        <option key={f.key} value={f.key}>
                          {f.label}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>

              {!hasFullNameMapped && (
                <p className="text-sm text-yellow-300 bg-yellow-500/10 border border-yellow-500/20 rounded-lg px-3 py-2">
                  Map at least one column to &quot;Full name&quot; to continue.
                </p>
              )}
              {error && <p className="text-sm text-red-400">{error}</p>}

              <button
                onClick={handleConfirmImport}
                disabled={!hasFullNameMapped || importing}
                className={cn(
                  "w-full flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition-colors",
                  hasFullNameMapped
                    ? "bg-white text-black hover:bg-neutral-200"
                    : "bg-white/10 text-neutral-500 cursor-not-allowed"
                )}
              >
                {importing && <Loader2 className="w-4 h-4 animate-spin" />}
                Import {rows.length} leads
              </button>
            </div>
          )}

          {step === "done" && (
            <div className="flex flex-col items-center text-center py-6">
              <CheckCircle2 className="w-12 h-12 text-green-400 mb-4" />
              <p className="text-white font-medium">Imported {importedCount} leads</p>
              <p className="text-sm text-neutral-500 mt-1">Your leads have been added to your lead universe.</p>
              <button
                onClick={onClose}
                className="mt-6 bg-white text-black font-semibold text-sm px-5 py-2.5 rounded-lg hover:bg-neutral-200 transition-colors"
              >
                Done
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
