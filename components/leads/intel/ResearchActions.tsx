"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowClockwise, CircleNotch, Sparkle, Warning } from "@phosphor-icons/react/ssr";
import { rescoreLead, researchLeads } from "@/lib/actions/intelligence";
import Button, { buttonClasses } from "@/components/ui/Button";
import { cn } from "@/lib/utils";
import { AI_BUTTON } from "../ai-styles";

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
    <div className="flex flex-wrap items-center justify-end gap-x-3 gap-y-1.5">
      {!engineConfigured && (
        <p className="inline-flex max-w-xs items-start gap-1.5 text-xs leading-snug text-amber-700">
          <Warning className="mt-px h-3.5 w-3.5 shrink-0" weight="fill" />
          The research engine isn&apos;t configured yet — ask an admin to set it up.
        </p>
      )}
      {message && (
        <p role="status" className={cn("max-w-xs text-xs leading-snug", message.ok ? "text-emerald-600" : "text-rose-600")}>
          {message.text}
        </p>
      )}
      <div className="flex items-center gap-2">
        {hasResearch && (
          <Button
            variant="secondary"
            onClick={rescore}
            disabled={pending || busy || !engineConfigured}
            title="Re-score against your current ICP using the stored, verified data (no new research)"
          >
            <ArrowClockwise className="h-4 w-4" weight="bold" /> Re-score
          </Button>
        )}
        <button
          type="button"
          onClick={research}
          disabled={pending || busy || !engineConfigured}
          className={buttonClasses({ variant: "primary", className: AI_BUTTON })}
        >
          {pending || busy ? <CircleNotch className="h-4 w-4 animate-spin" weight="bold" /> : <Sparkle className="h-4 w-4" weight="fill" />}
          {busy ? "Researching…" : hasResearch ? "Re-research" : "Research with Gennie"}
        </button>
      </div>
    </div>
  );
}
