"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle, CircleNotch, PaperPlaneTilt, WarningCircle, X } from "@phosphor-icons/react/ssr";
import { runDueSendsNow } from "@/lib/actions/dispatch";
import { cn } from "@/lib/utils";
import Button from "@/components/ui/Button";

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

  const message = error ?? result;

  return (
    <div className="relative">
      <Button variant="secondary" onClick={handleClick} disabled={isPending}>
        {isPending ? <CircleNotch className="h-4 w-4 animate-spin" weight="bold" /> : <PaperPlaneTilt className="h-4 w-4" weight="duotone" />}
        <span className="hidden sm:inline">Send due messages now</span>
        <span className="sm:hidden">Send due</span>
      </Button>
      {message && (
        <div
          role="status"
          className={cn(
            "absolute right-0 top-full z-30 mt-2 flex w-72 items-start gap-2 rounded-xl bg-white p-3 text-xs leading-relaxed shadow-2xl ring-1 ring-black/5",
            error ? "text-rose-600" : "text-neutral-700",
          )}
        >
          {error ? (
            <WarningCircle className="mt-px h-4 w-4 shrink-0" weight="fill" />
          ) : (
            <CheckCircle className="mt-px h-4 w-4 shrink-0 text-emerald-500" weight="fill" />
          )}
          <p className="flex-1">{message}</p>
          <button
            type="button"
            onClick={() => {
              setError(null);
              setResult(null);
            }}
            aria-label="Dismiss"
            className="-m-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-neutral-400 hover:bg-neutral-100 hover:text-neutral-900"
          >
            <X className="h-3.5 w-3.5" weight="bold" />
          </button>
        </div>
      )}
    </div>
  );
}
