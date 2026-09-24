"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Send, Loader2 } from "lucide-react";
import { runDueSendsNow } from "@/lib/actions/dispatch";

export default function SendNowButton() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function handleClick() {
    setError(null);
    setResult(null);
    startTransition(async () => {
      try {
        const { email, linkedin } = await runDueSendsNow();
        if ("skipped" in email) {
          setError(email.skipped as string);
          return;
        }
        setResult(
          `Email: ${email.sent} sent, ${email.failed} failed, ${email.blocked} blocked (${email.processed} due). ` +
            `LinkedIn: ${linkedin.queued} queued, ${linkedin.blocked} blocked.`
        );
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not run due sends");
      }
    });
  }

  return (
    <div className="flex flex-col items-end gap-1.5">
      <button
        onClick={handleClick}
        disabled={isPending}
        className="flex items-center gap-2 text-sm text-neutral-700 bg-white hover:bg-neutral-50 border border-neutral-200 hover:border-neutral-300 rounded-xl px-4 py-2.5 transition-colors disabled:opacity-50"
      >
        {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
        Send due messages now
      </button>
      {result && <p className="text-xs text-emerald-600 max-w-xs text-right">{result}</p>}
      {error && <p className="text-xs text-rose-600 max-w-xs text-right">{error}</p>}
    </div>
  );
}
