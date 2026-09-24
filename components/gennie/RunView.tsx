"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Loader2, Pause, Play, Rocket, X } from "lucide-react";
import { approveGennieRun, cancelGennieRun, getGennieRunAction, pauseGennieRun, resumeGennieRun } from "@/lib/actions/gennie";
import type { ActionResult } from "@/lib/api";
import type { GennieRunView } from "@/lib/domain/gennie/view";
import PlanCard from "./PlanCard";
import ResultsPanel from "./ResultsPanel";
import StepList from "./StepList";
import { RUN_STATUS } from "./status";

const POLL_MS = 3000;

const Card = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <section className="rounded-xl border border-white/10 bg-[#0A0A0A] p-5 md:p-6 space-y-4">
    <h2 className="text-xs font-semibold uppercase tracking-wider text-neutral-500">{title}</h2>
    {children}
  </section>
);

/** Plan → approve → live progress → results, for one Gennie run. Polls while the run is active. */
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
    <div className="p-4 md:p-8 max-w-4xl mx-auto space-y-5">
      <Link href="/dashboard" className="inline-flex items-center gap-1.5 text-sm text-neutral-400 hover:text-white transition-colors">
        <ArrowLeft className="w-4 h-4" /> Command Center
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-wider text-neutral-500 mb-1">You asked</p>
          <h1 className="text-lg font-semibold text-white break-words">{view.prompt}</h1>
        </div>
        <span className={`text-xs border rounded-full px-2.5 py-1 ${status.tone}`} role="status">{status.label}</span>
      </div>

      {view.error && <p role="alert" className="text-sm text-red-300 rounded-lg border border-red-500/20 bg-red-500/5 px-4 py-3">{view.error}</p>}
      {error && <p role="alert" className="text-sm text-red-300">{error}</p>}

      {view.plan && (
        <Card title={view.status === "awaiting_approval" ? "Plan — review before anything runs" : "Plan"}>
          <PlanCard plan={view.plan} />
          {view.steps.length > 0 && <StepList steps={view.steps} live={view.live} showEstimates={view.status === "awaiting_approval" || view.status === "planned"} />}

          {view.status === "awaiting_approval" && (
            <div className="space-y-2">
              <p className="text-xs text-neutral-500">
                Credits: not enforced yet (coming in a later phase) — usage is recorded. Gennie will not send any email, and you can cancel at any time.
              </p>
              {canControl ? (
                <div className="flex flex-wrap gap-2">
                  <button disabled={!view.canApprove || busy !== null} onClick={() => act("approve", approveGennieRun)} className={`${btn} bg-white text-black font-semibold hover:bg-neutral-200`}>
                    {busy === "approve" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Rocket className="w-4 h-4" />} Approve &amp; run
                  </button>
                  <button disabled={busy !== null} onClick={() => act("cancel", cancelGennieRun)} className={`${btn} border border-white/10 text-neutral-300 hover:text-white`}>
                    Cancel
                  </button>
                </div>
              ) : (
                <p className="text-xs text-neutral-500">You need member access to approve a plan.</p>
              )}
            </div>
          )}
        </Card>
      )}

      {(view.status === "running" || view.status === "paused") && canControl && (
        <div className="flex flex-wrap gap-2">
          {view.status === "running" ? (
            <button disabled={busy !== null} onClick={() => act("pause", pauseGennieRun)} className={`${btn} border border-white/10 text-neutral-300 hover:text-white`}><Pause className="w-4 h-4" /> Pause</button>
          ) : (
            <button disabled={busy !== null} onClick={() => act("resume", resumeGennieRun)} className={`${btn} border border-white/10 text-neutral-300 hover:text-white`}><Play className="w-4 h-4" /> Resume</button>
          )}
          <button disabled={busy !== null} onClick={() => act("cancel", cancelGennieRun)} className={`${btn} border border-white/10 text-neutral-300 hover:text-red-300`}><X className="w-4 h-4" /> Cancel</button>
          {view.status === "paused" && <p className="text-xs text-neutral-500 self-center">Paused: no new step starts. Research already queued keeps going.</p>}
        </div>
      )}

      {view.results && (
        <Card title={settled ? "Results" : "Results so far"}>
          <ResultsPanel results={view.results} final={settled} />
        </Card>
      )}
    </div>
  );
}
