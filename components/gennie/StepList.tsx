import { CheckCircle, CircleNotch, Lightning, ListNumbers, MagnifyingGlass, MinusCircle, Sparkle, UsersThree, XCircle } from "@phosphor-icons/react/ssr";
import type { StepView } from "@/lib/domain/gennie/view";
import type { NavIcon } from "@/lib/nav-config";
import { cn } from "@/lib/utils";
import { STEP_STATUS } from "./status";

const TOOL_ICON: Record<string, NavIcon> = {
  find_leads: UsersThree,
  research_leads: MagnifyingGlass,
  rank_leads: ListNumbers,
};

/** Left rail marker: a numbered dot while the plan is only proposed, a live state glyph once it runs. */
function Marker({ status, index, planning }: { status: StepView["status"]; index: number; planning: boolean }) {
  if (status === "succeeded") return <CheckCircle className="h-5 w-5 text-emerald-500" weight="fill" aria-hidden />;
  if (status === "running") return <CircleNotch className="h-5 w-5 animate-spin text-violet-500" weight="bold" aria-hidden />;
  if (status === "failed") return <XCircle className="h-5 w-5 text-rose-500" weight="fill" aria-hidden />;
  if (status === "skipped" || status === "canceled") return <MinusCircle className="h-5 w-5 text-neutral-300" weight="fill" aria-hidden />;
  return (
    <span
      aria-hidden
      className={cn(
        "flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-semibold tabular-nums",
        planning ? "bg-violet-50 text-violet-700 ring-1 ring-inset ring-violet-200" : "bg-white text-neutral-400 ring-1 ring-inset ring-neutral-200",
      )}
    >
      {index + 1}
    </span>
  );
}

/** The plan's steps as a checklist. Counts shown here (records, live progress) are measured, not guessed. */
export default function StepList({ steps, live, showEstimates }: { steps: StepView[]; live: { done: number; total: number; failed: number } | null; showEstimates: boolean }) {
  return (
    <ol className="relative">
      {steps.map((s, i) => {
        const ToolIcon = TOOL_ICON[s.tool] ?? Sparkle;
        const last = i === steps.length - 1;
        const muted = s.status === "skipped" || s.status === "canceled";
        const liveHere = s.status === "running" && live && s.tool === "research_leads";
        const pct = liveHere && live.total > 0 ? Math.round((live.done / live.total) * 100) : 0;
        return (
          <li key={s.id} className="relative flex gap-3 pb-4 last:pb-0">
            {!last && <span aria-hidden className={cn("absolute left-[9.5px] top-6 bottom-0 w-px", s.status === "succeeded" ? "bg-emerald-200" : "bg-neutral-200")} />}
            <div className="relative z-10 flex h-5 w-5 shrink-0 items-center justify-center bg-white">
              <Marker status={s.status} index={i} planning={showEstimates} />
            </div>
            <div className={cn("min-w-0 flex-1", muted && "opacity-60")}>
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <ToolIcon className="h-3.5 w-3.5 text-neutral-400" weight="duotone" />
                <p className="text-[13px] font-medium text-neutral-900">{s.label}</p>
                {s.costly && (
                  <span className="inline-flex h-5 items-center gap-1 rounded-md bg-amber-50 px-1.5 text-[11px] font-medium text-amber-700 ring-1 ring-inset ring-amber-200/70">
                    <Lightning className="h-3 w-3" weight="fill" />
                    Uses AI &amp; research budget
                  </span>
                )}
                {showEstimates && s.estimatedRecords !== null ? (
                  <span className="ml-auto text-[12px] tabular-nums text-neutral-500">
                    ~{s.estimatedRecords} {s.estimatedRecords === 1 ? "record" : "records"}
                  </span>
                ) : (
                  !showEstimates && (
                    <span className={cn("ml-auto text-[12px]", s.status === "running" ? "text-violet-600" : s.status === "failed" ? "text-rose-600" : "text-neutral-400")}>
                      {STEP_STATUS[s.status]}
                    </span>
                  )
                )}
              </div>
              <p className="mt-0.5 text-[12px] leading-relaxed text-neutral-500">{s.rationale}</p>
              {showEstimates && s.estimateNote && <p className="mt-0.5 text-[12px] text-neutral-400">{s.estimateNote}</p>}
              {liveHere && (
                <div className="mt-2 max-w-sm" role="status" aria-live="polite">
                  <div className="h-1.5 overflow-hidden rounded-full bg-violet-100">
                    <div className="h-full rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-500 transition-[width] duration-500" style={{ width: `${pct}%` }} />
                  </div>
                  <p className="mt-1 text-[12px] tabular-nums text-violet-700">
                    {live.done}/{live.total} researched{live.failed > 0 ? ` · ${live.failed} failed` : ""}
                  </p>
                </div>
              )}
              {s.summary && s.status !== "pending" && <p className="mt-1 text-[12px] text-neutral-700">{s.summary}</p>}
              {s.error && <p className="mt-1 text-[12px] text-rose-600">{s.error}</p>}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
