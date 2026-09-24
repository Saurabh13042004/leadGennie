"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Ban, Trash2, Loader2, X, Sparkles, Mail } from "lucide-react";
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
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-sm" role="region" aria-label="Bulk actions">
      {n > 0 && (
        <>
          <span className="text-white tabular-nums">{n} selected</span>
          {canResearch && (
            <button onClick={research} disabled={pending} className="inline-flex items-center gap-1.5 text-blue-200 hover:text-white disabled:opacity-50">
              {pending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />} Research selected
            </button>
          )}
          {canResearch && (
            <button onClick={drafts} disabled={pending} className="inline-flex items-center gap-1.5 text-emerald-200 hover:text-white disabled:opacity-50">
              {pending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />} Generate emails
            </button>
          )}
          {canEdit && (
            <button onClick={addToDnc} disabled={pending} className="inline-flex items-center gap-1.5 text-neutral-200 hover:text-white disabled:opacity-50">
              {pending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Ban className="w-4 h-4" />} Add to Do Not Contact
            </button>
          )}
          {canDelete && (
            <button onClick={remove} disabled={pending} className="inline-flex items-center gap-1.5 text-red-300 hover:text-red-200 disabled:opacity-50">
              <Trash2 className="w-4 h-4" /> Delete
            </button>
          )}
          <button onClick={onClear} className="ml-auto text-neutral-500 hover:text-white" aria-label="Clear selection"><X className="w-4 h-4" /></button>
        </>
      )}
      {runId !== null && <ResearchProgress agentRunId={runId} onFinished={() => router.refresh()} />}
      {draftRunId !== null && (
        <span className="inline-flex flex-wrap items-center gap-2">
          <ResearchProgress agentRunId={draftRunId} kind="drafts" onFinished={() => router.refresh()} />
          <Link href="/dashboard/leads/drafts?status=needs_review" className="text-xs text-emerald-200 underline hover:text-white">Review drafts</Link>
        </span>
      )}
      {message && <span className={message.tone === "ok" ? "text-green-300 text-xs" : "text-red-300 text-xs"}>{message.text}</span>}
    </div>
  );
}
