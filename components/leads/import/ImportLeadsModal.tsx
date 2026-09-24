"use client";

import { useRouter } from "next/navigation";
import { X, ArrowLeft, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { MAX_IMPORT_ROWS } from "@/lib/domain/leads/import/preview";
import { useLeadImport, type ImportStep } from "./useLeadImport";
import { ChooseStep, UploadStep } from "./ChooseUploadSteps";
import MapStep from "./MapStep";
import ReviewStep from "./ReviewStep";
import { ProgressStep, SummaryStep } from "./ProgressSummarySteps";

const STEPS: { key: ImportStep[]; label: string }[] = [
  { key: ["choose", "upload"], label: "Upload" },
  { key: ["map"], label: "Map" },
  { key: ["review"], label: "Review" },
  { key: ["importing", "done"], label: "Import" },
];
const BACK: Partial<Record<ImportStep, ImportStep>> = { upload: "choose", map: "upload", review: "map" };

function Stepper({ step }: { step: ImportStep }) {
  const current = STEPS.findIndex((s) => s.key.includes(step));
  return (
    <ol className="flex items-center gap-2 px-6 py-3 border-b border-white/5 text-xs">
      {STEPS.map((s, i) => (
        <li key={s.label} className="flex items-center gap-2">
          <span
            className={cn(
              "w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-semibold",
              i < current ? "bg-green-500/20 text-green-300" : i === current ? "bg-white text-black" : "bg-white/5 text-neutral-500",
            )}
          >
            {i < current ? <Check className="w-3 h-3" /> : i + 1}
          </span>
          <span className={i === current ? "text-white" : "text-neutral-500"}>{s.label}</span>
          {i < STEPS.length - 1 && <span className="w-6 h-px bg-white/10" />}
        </li>
      ))}
    </ol>
  );
}

export default function ImportLeadsModal({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const imp = useLeadImport();
  const back = BACK[imp.step];
  const busy = imp.step === "importing" && !imp.paused;

  function close() {
    if (busy) return; // don't orphan an in-flight import
    if (imp.job && imp.job.processedRows > 0) router.refresh();
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70" onClick={close} />
      <div role="dialog" aria-label="Import leads" className="relative w-full max-w-3xl max-h-[88vh] overflow-y-auto rounded-2xl border border-white/10 bg-[#0A0A0A] shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 sticky top-0 bg-[#0A0A0A] z-10">
          <div className="flex items-center gap-2">
            {back && !busy && (
              <button onClick={() => imp.setStep(back)} className="text-neutral-500 hover:text-white" aria-label="Back">
                <ArrowLeft className="w-4 h-4" />
              </button>
            )}
            <h2 className="text-white font-semibold">Import leads</h2>
          </div>
          <button onClick={close} disabled={busy} className="text-neutral-500 hover:text-white disabled:opacity-30" aria-label="Close">
            <X className="w-5 h-5" />
          </button>
        </div>
        <Stepper step={imp.step} />

        <div className="p-6">
          {imp.step === "choose" && <ChooseStep onCsv={() => imp.setStep("upload")} />}
          {imp.step === "upload" && <UploadStep onFile={imp.parseFile} error={imp.error} maxRows={MAX_IMPORT_ROWS} />}
          {imp.step === "map" && (
            <MapStep
              fileName={imp.fileName} headers={imp.headers} rows={imp.rows} mapping={imp.mapping}
              onChange={imp.setMapping} canContinue={imp.canContinueMapping} onContinue={imp.goToReview}
            />
          )}
          {imp.step === "review" && (
            <>
              <ReviewStep
                preview={imp.preview} classification={imp.classification} checking={imp.checking}
                options={imp.options} onOptions={imp.setOptions} onImport={imp.startImportRun}
              />
              {imp.error && <p className="text-sm text-red-400 mt-3">{imp.error}</p>}
            </>
          )}
          {imp.step === "importing" && <ProgressStep progress={imp.progress} error={imp.error} paused={imp.paused} onRetry={imp.retry} />}
          {imp.step === "done" && imp.job && (
            <SummaryStep job={imp.job} report={imp.report} headers={imp.headers} rows={imp.rows} fileName={imp.fileName} onDone={close} />
          )}
        </div>
      </div>
    </div>
  );
}
