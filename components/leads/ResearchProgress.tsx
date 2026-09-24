"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, X } from "lucide-react";
import { cancelResearchAction, getResearchProgressAction } from "@/lib/actions/intelligence";
import type { ResearchProgress as Progress } from "@/lib/intelligence/service";

const POLL_MS = 2500;

/** Live progress of a research batch, derived from its jobs. Polls until every job has settled. */
export default function ResearchProgress({ agentRunId, onFinished }: { agentRunId: number; onFinished: (p: Progress) => void }) {
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
      const res = await getResearchProgressAction(agentRunId);
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
  }, [agentRunId]);

  if (error) return <span className="text-xs text-red-300">{error}</span>;
  if (!progress) return <span className="inline-flex items-center gap-1.5 text-xs text-neutral-400"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Starting…</span>;

  const settled = progress.succeeded + progress.failed + progress.canceled;
  return (
    <span className="inline-flex flex-wrap items-center gap-2 text-xs" role="status" aria-live="polite">
      {!progress.finished && <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-300" />}
      <span className="text-neutral-200 tabular-nums">
        {progress.finished ? "Research finished" : "Researching"} — {settled}/{progress.total} done
      </span>
      {progress.failed > 0 && <span className="text-red-300">{progress.failed} failed</span>}
      {!progress.finished && (
        <button
          onClick={async () => { await cancelResearchAction(agentRunId); }}
          className="inline-flex items-center gap-1 text-neutral-500 hover:text-white"
        >
          <X className="w-3 h-3" /> Cancel
        </button>
      )}
      {progress.finished && progress.errors.length > 0 && (
        <span className="text-red-300/90" title={progress.errors.map((e) => e.message).join("\n")}>{progress.errors[0].message}</span>
      )}
    </span>
  );
}
