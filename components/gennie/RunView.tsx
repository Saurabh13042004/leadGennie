"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { CircleNotch, Pause, Play, Plus, Rocket, Sparkle, WarningCircle, X } from "@phosphor-icons/react/ssr";
import { approveGennieRun, cancelGennieRun, getGennieRunAction, pauseGennieRun, resumeGennieRun } from "@/lib/actions/gennie";
import type { ActionResult } from "@/lib/api";
import type { GennieRunView } from "@/lib/domain/gennie/view";
import PageHeader from "@/components/ui/PageHeader";
import Badge from "@/components/ui/Badge";
import Button, { buttonClasses } from "@/components/ui/Button";
import AskGennie from "./AskGennie";
import GennieMark from "./GennieMark";
import PlanCard from "./PlanCard";
import ResultsPanel from "./ResultsPanel";
import StepList from "./StepList";
import { RUN_STATUS } from "./status";

const POLL_MS = 3000;

type Busy = null | "approve" | "cancel" | "pause" | "resume";

const LEAD_IN: Partial<Record<GennieRunView["status"], string>> = {
  awaiting_approval: "Here's my plan. Nothing runs until you approve it.",
  planned: "I couldn't turn this into something I can run yet.",
  running: "Working on it — this page updates as each step finishes.",
  paused: "Paused. No new step starts until you resume.",
  completed: "Done. Here's what I did and what I found.",
  failed: "I had to stop before finishing.",
  canceled: "This run was canceled.",
};

/** Plan → approve → live progress → results, for one Gennie run — shown as a chat thread. Polls while the run is active. */
export default function RunView({ initial, canControl }: { initial: GennieRunView; canControl: boolean }) {
  const [view, setView] = useState(initial);
  const [busy, setBusy] = useState<Busy>(null);
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

  async function act(kind: NonNullable<Busy>, fn: (id: number) => Promise<ActionResult<unknown>>) {
    setBusy(kind);
    setError(null);
    const res = await fn(initial.id);
    if (!res.ok) setError(res.error.message);
    await refresh();
    setBusy(null);
  }

  const status = RUN_STATUS[view.status];
  const settled = view.status === "completed" || view.status === "failed" || view.status === "canceled";
  const proposing = view.status === "awaiting_approval" || view.status === "planned";
  const spin = <CircleNotch className="h-4 w-4 animate-spin" weight="bold" />;

  const footer =
    view.status === "awaiting_approval" ? (
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <p className="min-w-0 flex-1 text-[12px] leading-relaxed text-neutral-500">
          Credits: not enforced yet (coming in a later phase) — usage is recorded. Gennie will not send any email, and you can cancel at any time.
        </p>
        {canControl ? (
          <div className="flex shrink-0 gap-2">
            <Button disabled={busy !== null} onClick={() => act("cancel", cancelGennieRun)}>
              {busy === "cancel" && spin} Cancel
            </Button>
            <Button
              variant="primary"
              disabled={!view.canApprove || busy !== null}
              onClick={() => act("approve", approveGennieRun)}
              className="bg-gradient-to-br from-violet-600 to-fuchsia-600 shadow-[0_2px_8px_-2px_rgba(124,58,237,0.6),inset_0_1px_0_rgba(255,255,255,0.18)] hover:brightness-110"
            >
              {busy === "approve" ? spin : <Rocket className="h-4 w-4" weight="duotone" />} Approve &amp; run
            </Button>
          </div>
        ) : (
          <p className="shrink-0 text-[12px] text-neutral-400">You need member access to approve a plan.</p>
        )}
      </div>
    ) : (view.status === "running" || view.status === "paused") && canControl ? (
      <div className="flex flex-wrap items-center gap-2">
        {view.status === "running" ? (
          <Button disabled={busy !== null} onClick={() => act("pause", pauseGennieRun)}>
            {busy === "pause" ? spin : <Pause className="h-4 w-4" weight="duotone" />} Pause
          </Button>
        ) : (
          <Button disabled={busy !== null} onClick={() => act("resume", resumeGennieRun)}>
            {busy === "resume" ? spin : <Play className="h-4 w-4" weight="duotone" />} Resume
          </Button>
        )}
        <Button variant="danger" disabled={busy !== null} onClick={() => act("cancel", cancelGennieRun)}>
          {busy === "cancel" ? spin : <X className="h-3.5 w-3.5" weight="bold" />} Cancel
        </Button>
        {view.status === "paused" && <p className="text-[12px] text-neutral-500">Paused: no new step starts. Research already queued keeps going.</p>}
      </div>
    ) : null;

  return (
    <div className="flex min-h-full flex-col">
      <PageHeader
        icon={Sparkle}
        crumbs={[{ label: "Ask Gennie", href: "/dashboard/gennie" }]}
        title={<span className="font-medium">{view.prompt || `Run #${view.id}`}</span>}
        actions={
          <Link href="/dashboard/gennie" className={buttonClasses({ variant: "secondary", size: "xs" })}>
            <Plus className="h-3.5 w-3.5" weight="bold" /> New chat
          </Link>
        }
      />

      <div className="mx-auto w-full max-w-3xl flex-1 space-y-8 px-4 py-8 md:px-6">
        {/* The user's turn */}
        <div className="flex justify-end">
          <div className="max-w-[85%] rounded-2xl rounded-br-md bg-neutral-100 px-4 py-2.5 text-[14px] leading-relaxed text-neutral-900 ring-1 ring-inset ring-neutral-200/60">
            <p className="whitespace-pre-wrap break-words">{view.prompt}</p>
          </div>
        </div>

        {/* Gennie's turn */}
        <div className="flex items-start gap-3">
          <GennieMark size="sm" className="mt-0.5" />
          <div className="min-w-0 flex-1 space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[13px] font-semibold text-neutral-900">Gennie</span>
              <span role="status">
                <Badge tone={status.tone} dot pulse={status.pulse}>{status.label}</Badge>
              </span>
            </div>

            {(LEAD_IN[view.status] || view.plan) && (
              <div className="space-y-1 text-[14px] leading-relaxed text-neutral-800">
                {LEAD_IN[view.status] && <p>{LEAD_IN[view.status]}</p>}
                {view.plan && <p className="text-neutral-600"><span className="text-neutral-400">Goal: </span>{view.plan.goal}</p>}
              </div>
            )}

            {view.error && (
              <p role="alert" className="flex items-start gap-2 rounded-xl bg-rose-50 px-3.5 py-3 text-[13px] text-rose-800 ring-1 ring-inset ring-rose-200/70">
                <WarningCircle className="mt-px h-4 w-4 shrink-0 text-rose-500" weight="fill" />
                {view.error}
              </p>
            )}
            {error && (
              <p role="alert" className="flex items-start gap-1.5 text-[13px] text-rose-600">
                <WarningCircle className="mt-px h-4 w-4 shrink-0" weight="fill" />
                {error}
              </p>
            )}

            {view.plan && (
              <PlanCard
                plan={view.plan}
                title={proposing ? "Plan" : view.status === "running" || view.status === "paused" ? "Progress" : "Steps"}
                hint={view.status === "awaiting_approval" ? "Review before anything runs" : undefined}
                footer={footer}
              >
                {view.steps.length > 0 && <StepList steps={view.steps} live={view.live} showEstimates={proposing} />}
              </PlanCard>
            )}

            {view.results && <ResultsPanel results={view.results} final={settled} />}
          </div>
        </div>
      </div>

      <div className="sticky bottom-0 z-10 bg-gradient-to-t from-white from-60% to-white/0 pb-4 pt-8">
        <div className="mx-auto max-w-3xl px-4 md:px-6">
          <AskGennie variant="followup" canPlan={canControl} />
        </div>
      </div>
    </div>
  );
}
