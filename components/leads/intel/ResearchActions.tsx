"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, RefreshCw, Sparkles } from "lucide-react";
import { rescoreLead, researchLeads } from "@/lib/actions/intelligence";

const BUSY = new Set(["queued", "running"]);

export default function ResearchActions({
  leadId, researchStatus, hasResearch, canResearch, engineConfigured,
}: {
  leadId: number;
  researchStatus: string;
  hasResearch: boolean;
  canResearch: boolean;
  engineConfigured: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const busy = BUSY.has(researchStatus);

  // While research runs in the background, keep the page fresh (server-rendered data, no client copy to drift).
  useEffect(() => {
    if (!busy) return;
    const t = setInterval(() => router.refresh(), 3000);
    return () => clearInterval(t);
  }, [busy, router]);

  if (!canResearch) return null;

  const research = () => {
    setMessage(null);
    start(async () => {
      const res = await researchLeads([leadId]);
      if (!res.ok) return setMessage({ ok: false, text: res.error.message });
      if (res.data.enqueued.length === 0) {
        const reason = res.data.skipped[0]?.reason;
        return setMessage({ ok: false, text: reason === "no_company" ? "Add a company or company website to this lead first." : "Research is already running for this lead." });
      }
      router.refresh();
    });
  };

  const rescore = () => {
    setMessage(null);
    start(async () => {
      const res = await rescoreLead(leadId);
      setMessage(res.ok ? { ok: true, text: res.data.enqueued ? "Re-scoring…" : "Already scored against your current ICP." } : { ok: false, text: res.error.message });
      router.refresh();
    });
  };

  return (
    <div className="flex flex-col items-end gap-1.5">
      <div className="flex items-center gap-2">
        <button
          onClick={research}
          disabled={pending || busy || !engineConfigured}
          className="inline-flex items-center gap-2 rounded-lg bg-white text-black font-semibold text-sm px-4 py-2 hover:bg-neutral-200 transition-colors disabled:opacity-50"
        >
          {pending || busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
          {busy ? "Researching…" : hasResearch ? "Re-research" : "Research with Gennie"}
        </button>
        {hasResearch && (
          <button
            onClick={rescore}
            disabled={pending || busy || !engineConfigured}
            title="Re-score against your current ICP using the stored, verified data (no new research)"
            className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 text-sm text-neutral-200 px-3 py-2 hover:bg-white/5 disabled:opacity-50"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Re-score
          </button>
        )}
      </div>
      {!engineConfigured && <p className="text-xs text-yellow-200/80">The research engine isn&apos;t configured yet — ask an admin to set it up.</p>}
      {message && <p role="status" className={message.ok ? "text-xs text-green-300" : "text-xs text-red-300"}>{message.text}</p>}
    </div>
  );
}
