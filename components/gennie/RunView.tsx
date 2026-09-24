"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Loader2, Pause, Play, Plus, Rocket, Sparkles, X } from "lucide-react";
import { approveGennieRun, cancelGennieRun, getGennieRunAction, pauseGennieRun, resumeGennieRun } from "@/lib/actions/gennie";
import type { ActionResult } from "@/lib/api";
import type { GennieRunView } from "@/lib/domain/gennie/view";
import PlanCard from "./PlanCard";
import ResultsPanel from "./ResultsPanel";
import StepList from "./StepList";
import { RUN_STATUS } from "./status";

const POLL_MS = 3000;

const Card = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <section className="rounded-2xl border border-neutral-200 bg-white p-5 space-y-4">
    <h2 className="text-xs font-bold uppercase tracking-wider text-neutral-400">{title}</h2>
    {children}
  </section>
);

/** Plan → approve → live progress → results, for one Gennie run — shown as a two-turn chat exchange. Polls while the run is active. */
export default function RunView({ initial, canControl }: { initial: GennieRunView; canControl: boolean }) {
  const [view, setView] = useState(initial);
  const [busy, setBusy] = useState<null | "approve" | "cancel" | "pause" | "resume">(null);
  const [error, setError] = useState<string | null>(null);
  const active = useRef(view.active);
  useEffect(() => {
    active.current = view.active;
  });

  const refresh = useCallback(async () => {
    const res = await getGennieRunAction(initial.id);
    if (res.ok) setView(res.data);
    else setError(res.error.message);
  }, [initial.id]);

  useEffect(() => {
    const timer = setInterval(() => {
      if (active.current) void refresh();
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [refresh]);

  async function act(kind: NonNullable<typeof busy>, fn: (id: number) => Promise<ActionResult<unknown>>) {
    setBusy(kind);
    setError(null);
    const res = await fn(initial.id);
    if (!res.ok) setError(res.error.message);
    await refresh();
    setBusy(null);
  }

  const status = RUN_STATUS[view.status];
  const settled = view.status === "completed" || view.status === "failed" || view.status === "canceled";
  const btn = "flex items-center gap-1.5 text-sm rounded-lg px-3.5 py-2 transition-colors disabled:opacity-50";

  return (
    <div className="mx-auto max-w-3xl p-4 md:p-8 space-y-6">
      <Link href="/dashboard/gennie" className="inline-flex items-center gap-1.5 text-sm text-neutral-400 hover:text-neutral-900 transition-colors">
        <Sparkles className="w-4 h-4" /> Ask Gennie
      </Link>

      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-2xl rounded-br-md bg-neutral-900 px-4 py-3 text-white">
          <p className="text-sm break-words">{view.prompt}</p>
        </div>
      </div>

      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-indigo-50 text-indigo-600">
          <Sparkles className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1 space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-bold text-neutral-900">Gennie</span>
            <span className={`text-xs rounded-full px-2.5 py-1 ${status.tone}`} role="status">{status.label}</span>
          </div>

          {view.error && <p role="alert" className="text-sm text-rose-700 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3">{view.error}</p>}
          {error && <p role="alert" className="text-sm text-rose-600">{error}</p>}

          {view.plan && (
            <Card title={view.status === "awaiting_approval" ? "Plan — review before anything runs" : "Plan"}>
              <PlanCard plan={view.plan} />
              {view.steps.length > 0 && <StepList steps={view.steps} live={view.live} showEstimates={view.status === "awaiting_approval" || view.status === "planned"} />}

              {view.status === "awaiting_approval" && (
                <div className="space-y-2">
                  <p className="text-xs text-neutral-400">
                    Credits: not enforced yet (coming in a later phase) — usage is recorded. Gennie will not send any email, and you can cancel at any time.
                  </p>
                  {canControl ? (
                    <div className="flex flex-wrap gap-2">
                      <button disabled={!view.canApprove || busy !== null} onClick={() => act("approve", approveGennieRun)} className={`${btn} bg-neutral-900 text-white font-semibold hover:bg-neutral-800`}>
                        {busy === "approve" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Rocket className="w-4 h-4" />} Approve &amp; run
                      </button>
                      <button disabled={busy !== null} onClick={() => act("cancel", cancelGennieRun)} className={`${btn} border border-neutral-200 bg-white text-neutral-600 hover:text-neutral-900 hover:bg-neutral-50`}>
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <p className="text-xs text-neutral-400">You need member access to approve a plan.</p>
                  )}
                </div>
              )}
            </Card>
          )}

          {(view.status === "running" || view.status === "paused") && canControl && (
            <div className="flex flex-wrap gap-2">
              {view.status === "running" ? (
                <button disabled={busy !== null} onClick={() => act("pause", pauseGennieRun)} className={`${btn} border border-neutral-200 bg-white text-neutral-600 hover:text-neutral-900 hover:bg-neutral-50`}><Pause className="w-4 h-4" /> Pause</button>
              ) : (
                <button disabled={busy !== null} onClick={() => act("resume", resumeGennieRun)} className={`${btn} border border-neutral-200 bg-white text-neutral-600 hover:text-neutral-900 hover:bg-neutral-50`}><Play className="w-4 h-4" /> Resume</button>
              )}
              <button disabled={busy !== null} onClick={() => act("cancel", cancelGennieRun)} className={`${btn} border border-neutral-200 bg-white text-neutral-600 hover:text-rose-600 hover:border-rose-200`}><X className="w-4 h-4" /> Cancel</button>
              {view.status === "paused" && <p className="text-xs text-neutral-400 self-center">Paused: no new step starts. Research already queued keeps going.</p>}
            </div>
          )}

          {view.results && (
            <Card title={settled ? "Results" : "Results so far"}>
              <ResultsPanel results={view.results} final={settled} />
            </Card>
          )}
        </div>
      </div>

      <div className="pt-2">
        <Link
          href="/dashboard/gennie"
          className="inline-flex items-center gap-2 rounded-xl border border-neutral-200 bg-white px-4 py-2.5 text-sm font-semibold text-neutral-700 transition-colors hover:border-neutral-300 hover:bg-neutral-50"
        >
          <Plus className="w-4 h-4" /> Ask something else
        </Link>
      </div>
    </div>
  );
}
