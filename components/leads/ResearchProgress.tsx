"use client";

import { useEffect, useRef, useState } from "react";
import { CircleNotch, X } from "@phosphor-icons/react/ssr";
import { cancelResearchAction, getResearchProgressAction } from "@/lib/actions/intelligence";
import { getDraftBatchProgressAction } from "@/lib/actions/personalization";
import type { ResearchProgress as Progress } from "@/lib/intelligence/service";

const POLL_MS = 2500;

/** Live progress of a research batch, derived from its jobs. Polls until every job has settled. */
export default function ResearchProgress({ agentRunId, onFinished, kind = "research" }: { agentRunId: number; onFinished: (p: Progress) => void; /** Which batch this is; drafting has no engine run to cancel. */ kind?: "research" | "drafts" }) {
  const [progress, setProgress] = useState<Progress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const finished = useRef(false);
  const notify = useRef(onFinished);
  useEffect(() => {
    notify.current = onFinished; // latest callback, without re-subscribing the poller
  });

  useEffect(() => {
    let stopped = false;
    async function tick() {
      const res = kind === "drafts" ? await getDraftBatchProgressAction(agentRunId) : await getResearchProgressAction(agentRunId);
      if (stopped) return;
      if (!res.ok) {
        setError(res.error.message);
        return;
      }
      setProgress(res.data);
      if (res.data.finished && !finished.current) {
        finished.current = true;
        notify.current(res.data);
      }
    }
    void tick();
    const timer = setInterval(() => { if (!finished.current) void tick(); }, POLL_MS);
    return () => { stopped = true; clearInterval(timer); };
  }, [agentRunId, kind]);

  if (error) return <span className="text-xs text-rose-600">{error}</span>;
  if (!progress) return <span className="inline-flex items-center gap-1.5 text-xs text-neutral-500"><CircleNotch className="h-3.5 w-3.5 animate-spin" weight="bold" /> Starting…</span>;

  const settled = progress.succeeded + progress.failed + progress.canceled;
  return (
    <span className="inline-flex flex-wrap items-center gap-2 text-xs" role="status" aria-live="polite">
      {!progress.finished && <CircleNotch className="h-3.5 w-3.5 animate-spin text-indigo-600" weight="bold" />}
      <span className="text-neutral-700 tabular-nums font-medium">
        {kind === "drafts" ? (progress.finished ? "Drafts ready" : "Writing emails") : progress.finished ? "Research finished" : "Researching"} — {settled}/{progress.total} done
      </span>
      {progress.failed > 0 && <span className="text-rose-600">{progress.failed} failed</span>}
      {!progress.finished && kind === "research" && (
        <button
          onClick={async () => { await cancelResearchAction(agentRunId); }}
          className="inline-flex items-center gap-1 text-neutral-500 hover:text-neutral-900"
        >
          <X className="h-3 w-3" weight="bold" /> Cancel
        </button>
      )}
      {progress.finished && progress.errors.length > 0 && (
        <span className="text-rose-600" title={progress.errors.map((e) => e.message).join("\n")}>{progress.errors[0].message}</span>
      )}
    </span>
  );
}
