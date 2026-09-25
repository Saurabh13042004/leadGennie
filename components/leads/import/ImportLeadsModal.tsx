"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft, Check } from "@phosphor-icons/react/ssr";
import { cn } from "@/lib/utils";
import { MAX_IMPORT_ROWS } from "@/lib/domain/leads/import/preview";
import { useLeadImport, type ImportStep } from "./useLeadImport";
import { ChooseStep, UploadStep } from "./ChooseUploadSteps";
import MapStep from "./MapStep";
import ReviewStep from "./ReviewStep";
import { ProgressStep, SummaryStep } from "./ProgressSummarySteps";
import Modal from "@/components/ui/Modal";

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
    <ol className="flex items-center gap-2 overflow-x-auto px-5 py-3 text-xs">
      {STEPS.map((s, i) => (
        <li key={s.label} className="flex flex-1 items-center gap-2 last:flex-none">
          <span
            className={cn(
              "flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold tabular-nums transition-colors",
              i < current ? "bg-indigo-600 text-white" : i === current ? "bg-neutral-900 text-white ring-4 ring-neutral-900/10" : "bg-white text-neutral-400 ring-1 ring-inset ring-neutral-200",
            )}
          >
            {i < current ? <Check className="h-3 w-3" weight="bold" /> : i + 1}
          </span>
          <span className={cn("whitespace-nowrap font-medium", i === current ? "text-neutral-900" : i < current ? "text-neutral-600" : "text-neutral-400")}>{s.label}</span>
          {i < STEPS.length - 1 && <span className={cn("h-px min-w-4 flex-1", i < current ? "bg-indigo-300" : "bg-neutral-200")} />}
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
    <Modal
      title="Import leads"
      description="CSV with column mapping, deduped by email"
      label="Import leads"
      size="2xl"
      onClose={close}
      closeDisabled={busy}
      leading={
        back && !busy ? (
          <button onClick={() => imp.setStep(back)} className="-ml-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-900" aria-label="Back">
            <ArrowLeft className="h-4 w-4" weight="bold" />
          </button>
        ) : undefined
      }
      subheader={<Stepper step={imp.step} />}
    >
      <div className="p-5">
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
            {imp.error && <p className="mt-3 text-[13px] text-rose-600">{imp.error}</p>}
          </>
        )}
        {imp.step === "importing" && <ProgressStep progress={imp.progress} error={imp.error} paused={imp.paused} onRetry={imp.retry} />}
        {imp.step === "done" && imp.job && (
          <SummaryStep job={imp.job} report={imp.report} headers={imp.headers} rows={imp.rows} fileName={imp.fileName} onDone={close} />
        )}
      </div>
    </Modal>
  );
}
