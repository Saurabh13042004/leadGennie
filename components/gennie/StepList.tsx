import { CheckCircle2, Circle, Loader2, MinusCircle, XCircle } from "lucide-react";
import type { StepView } from "@/lib/domain/gennie/view";
import { STEP_STATUS } from "./status";

function Icon({ status }: { status: StepView["status"] }) {
  if (status === "succeeded") return <CheckCircle2 className="w-4 h-4 text-green-400" aria-hidden />;
  if (status === "running") return <Loader2 className="w-4 h-4 text-blue-300 animate-spin" aria-hidden />;
  if (status === "failed") return <XCircle className="w-4 h-4 text-red-400" aria-hidden />;
  if (status === "skipped" || status === "canceled") return <MinusCircle className="w-4 h-4 text-neutral-600" aria-hidden />;
  return <Circle className="w-4 h-4 text-neutral-600" aria-hidden />;
}

/** Numbered steps with state. Counts shown here (records, live progress) are measured, not guessed. */
export default function StepList({ steps, live, showEstimates }: { steps: StepView[]; live: { done: number; total: number; failed: number } | null; showEstimates: boolean }) {
  return (
    <ol className="space-y-2">
      {steps.map((s, i) => (
        <li key={s.id} className="flex gap-3 rounded-lg border border-white/10 bg-white/[0.02] px-4 py-3">
          <div className="pt-0.5"><Icon status={s.status} /></div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm text-white">{i + 1}. {s.label}</p>
              {s.costly && <span className="text-[10px] uppercase tracking-wide text-amber-300 border border-amber-500/30 rounded px-1.5 py-0.5">Uses AI &amp; research budget</span>}
              <span className="text-[11px] text-neutral-500">{STEP_STATUS[s.status]}</span>
            </div>
            <p className="text-xs text-neutral-500 mt-0.5">{s.rationale}</p>
            {showEstimates && s.estimatedRecords !== null && (
              <p className="text-xs text-neutral-400 mt-1">
                About {s.estimatedRecords} {s.estimatedRecords === 1 ? "record" : "records"}
                {s.estimateNote ? ` · ${s.estimateNote}` : ""}
              </p>
            )}
            {s.status === "running" && live && s.tool === "research_leads" && (
              <p className="text-xs text-blue-300 mt-1 tabular-nums" role="status" aria-live="polite">
                {live.done}/{live.total} researched{live.failed > 0 ? ` · ${live.failed} failed` : ""}
              </p>
            )}
            {s.summary && s.status !== "pending" && <p className="text-xs text-neutral-300 mt-1">{s.summary}</p>}
            {s.error && <p className="text-xs text-red-300 mt-1">{s.error}</p>}
          </div>
        </li>
      ))}
    </ol>
  );
}
