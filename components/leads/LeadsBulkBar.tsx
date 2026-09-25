"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CircleNotch, EnvelopeSimple, Prohibit, Sparkle, Trash, X } from "@phosphor-icons/react/ssr";
import { cn } from "@/lib/utils";
import { bulkAddToDnc, bulkDeleteLeads } from "@/lib/actions/leads-bulk";
import { researchLeads } from "@/lib/actions/intelligence";
import { generateEmailDrafts } from "@/lib/actions/personalization";
import ResearchProgress from "./ResearchProgress";

export default function LeadsBulkBar({
  selectedIds, canEdit, canDelete, canResearch = false, onClear,
}: {
  selectedIds: number[];
  canEdit: boolean;
  canDelete: boolean;
  canResearch?: boolean;
  onClear: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const n = selectedIds.length;
  const [runId, setRunId] = useState<number | null>(null);
  const [draftRunId, setDraftRunId] = useState<number | null>(null);

  function run(work: () => Promise<{ ok: boolean; text: string }>) {
    setMessage(null);
    startTransition(async () => {
      const r = await work();
      setMessage({ tone: r.ok ? "ok" : "error", text: r.text });
      if (r.ok) {
        onClear();
        router.refresh();
      }
    });
  }

  const addToDnc = () =>
    run(async () => {
      const res = await bulkAddToDnc(selectedIds);
      if (!res.ok) return { ok: false, text: res.error.message };
      const { added, withEmail, selected } = res.data;
      const skipped = selected - withEmail;
      return {
        ok: true,
        text: `${added} email${added === 1 ? "" : "s"} added to Do Not Contact${withEmail - added > 0 ? `, ${withEmail - added} already listed` : ""}${skipped > 0 ? `, ${skipped} lead${skipped === 1 ? " has" : "s have"} no email` : ""}.`,
      };
    });

  const research = () => {
    setMessage(null);
    startTransition(async () => {
      const res = await researchLeads(selectedIds);
      if (!res.ok) {
        setMessage({ tone: "error", text: res.error.message });
        return;
      }
      const { enqueued, skipped, agentRunId } = res.data;
      if (enqueued.length === 0) {
        setMessage({ tone: "error", text: skipped.length ? "Nothing to research: these leads have no company or are already being researched." : "Nothing to research." });
        return;
      }
      setRunId(agentRunId);
      onClear();
      router.refresh();
    });
  };

  const drafts = () => {
    setMessage(null);
    startTransition(async () => {
      const res = await generateEmailDrafts(selectedIds);
      if (!res.ok) {
        setMessage({ tone: "error", text: res.error.message });
        return;
      }
      if (res.data.enqueued.length === 0) {
        setMessage({ tone: "error", text: "Nothing to generate: those leads were not found or already have a draft in progress." });
        return;
      }
      setDraftRunId(res.data.agentRunId);
      onClear();
    });
  };

  const remove = () => {
    if (!confirm(`Delete ${n} lead${n === 1 ? "" : "s"}? Leads that were already contacted are kept. This can't be undone.`)) return;
    run(async () => {
      const res = await bulkDeleteLeads(selectedIds);
      if (!res.ok) return { ok: false, text: res.error.message };
      const { deleted, keptBecauseContacted } = res.data;
      return { ok: true, text: `${deleted} deleted${keptBecauseContacted ? `, ${keptBecauseContacted} kept (already contacted — use Do Not Contact instead)` : ""}.` };
    });
  };

  if (n === 0 && !message && runId === null && draftRunId === null) return null;
  const action = "inline-flex h-7 items-center gap-1.5 rounded-md px-2 text-[13px] font-medium transition-colors disabled:opacity-50";
  const spin = <CircleNotch className="h-3.5 w-3.5 animate-spin" weight="bold" />;
  return (
    <div className="pointer-events-none sticky bottom-4 z-30 mt-3 flex justify-center px-4">
      <div
        className="pointer-events-auto flex max-w-full flex-wrap items-center gap-1 rounded-xl bg-neutral-900 p-1.5 pl-3 text-white shadow-[0_12px_32px_-8px_rgba(0,0,0,0.45),0_0_0_1px_rgba(255,255,255,0.06)_inset]"
        role="region"
        aria-label="Bulk actions"
      >
        {n > 0 && (
          <>
            <span className="mr-1 inline-flex items-center gap-2 text-[13px] font-medium tabular-nums">
              <span className="flex h-5 min-w-5 items-center justify-center rounded bg-white/15 px-1 text-[11px]">{n}</span>
              selected
            </span>
            <span className="mx-1 h-4 w-px bg-white/15" />
            {canResearch && (
              <button onClick={research} disabled={pending} className={cn(action, "text-violet-200 hover:bg-white/10 hover:text-white")}>
                {pending ? spin : <Sparkle className="h-3.5 w-3.5" weight="fill" />} Research
              </button>
            )}
            {canResearch && (
              <button onClick={drafts} disabled={pending} className={cn(action, "text-neutral-200 hover:bg-white/10 hover:text-white")}>
                {pending ? spin : <EnvelopeSimple className="h-3.5 w-3.5" weight="duotone" />} Generate emails
              </button>
            )}
            {canEdit && (
              <button onClick={addToDnc} disabled={pending} className={cn(action, "text-neutral-200 hover:bg-white/10 hover:text-white")}>
                {pending ? spin : <Prohibit className="h-3.5 w-3.5" weight="bold" />} Do Not Contact
              </button>
            )}
            {canDelete && (
              <button onClick={remove} disabled={pending} className={cn(action, "text-rose-300 hover:bg-rose-500/15 hover:text-rose-200")}>
                <Trash className="h-3.5 w-3.5" /> Delete
              </button>
            )}
            <button onClick={onClear} className="ml-1 flex h-7 w-7 items-center justify-center rounded-md text-neutral-400 hover:bg-white/10 hover:text-white" aria-label="Clear selection">
              <X className="h-3.5 w-3.5" weight="bold" />
            </button>
          </>
        )}
        {(runId !== null || draftRunId !== null || message) && (
          <div className="flex flex-wrap items-center gap-2 rounded-lg bg-white px-2.5 py-1.5 text-neutral-800">
            {runId !== null && <ResearchProgress agentRunId={runId} onFinished={() => router.refresh()} />}
            {draftRunId !== null && (
              <span className="inline-flex flex-wrap items-center gap-2">
                <ResearchProgress agentRunId={draftRunId} kind="drafts" onFinished={() => router.refresh()} />
                <Link href="/dashboard/leads/drafts?status=needs_review" className="text-xs font-medium text-indigo-600 hover:text-indigo-800">Review drafts →</Link>
              </span>
            )}
            {message && <span className={message.tone === "ok" ? "text-xs font-medium text-emerald-700" : "text-xs font-medium text-rose-600"}>{message.text}</span>}
          </div>
        )}
      </div>
    </div>
  );
}
