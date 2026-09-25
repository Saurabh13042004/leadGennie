"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowRight, Info, ShieldCheck, UploadSimple, WarningCircle } from "@phosphor-icons/react/ssr";
import { planGennieRun } from "@/lib/actions/gennie";
import { buttonClasses } from "@/components/ui/Button";
import Composer from "./Composer";
import Suggestions from "./Suggestions";

/**
 * The Ask Gennie composer. It only PLANS — nothing runs until the user approves on the next screen.
 * `followup` is the slim version docked under a run: same action, no suggestions.
 */
export default function AskGennie({
  suggestions = [],
  leadCount,
  canPlan,
  engineAvailable = true,
  variant = "home",
}: {
  suggestions?: string[];
  leadCount?: number;
  canPlan: boolean;
  engineAvailable?: boolean;
  variant?: "home" | "followup";
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [prompt, setPrompt] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const home = variant === "home";
  const noLeads = home && leadCount === 0;

  async function submit(text: string) {
    const value = text.trim();
    if (!value || busy) return;
    setBusy(true);
    setError(null);
    const res = await planGennieRun(value);
    if (res.ok) {
      router.push(`/dashboard/gennie/${res.data.runId}`);
      return; // keep the busy state while navigating
    }
    setError(res.error.message);
    setBusy(false);
  }

  function pickSuggestion(s: string) {
    setPrompt(s);
    setError(null);
    const el = inputRef.current;
    if (el) {
      el.focus();
      // Put the caret at the end so the user can tweak or just hit send.
      requestAnimationFrame(() => el.setSelectionRange(s.length, s.length));
    }
  }

  return (
    <div className="w-full">
      <Composer
        value={prompt}
        onChange={setPrompt}
        onSubmit={() => void submit(prompt)}
        disabled={!canPlan}
        busy={busy}
        inputRef={inputRef}
        size={home ? "lg" : "md"}
        placeholder={
          !canPlan
            ? "You need member access to ask Gennie"
            : home
              ? "Ask Gennie to find, research or rank your leads…"
              : "Ask Gennie something else…"
        }
        footer={
          home && <span className="inline-flex items-center gap-1.5">
            <ShieldCheck className="h-3.5 w-3.5 text-neutral-400" weight="duotone" />
            <span className="hidden sm:inline">Plans first — nothing runs until you approve, and it never sends email.</span>
            <span className="sm:hidden">Plans first · never sends email</span>
          </span>
        }
      />

      {!home && <p className="mt-2 text-center text-[11px] text-neutral-400">Starts a new plan — nothing runs until you approve, and Gennie never sends email.</p>}

      {error && (
        <p role="alert" className="mt-2.5 flex items-start gap-1.5 px-1 text-[13px] text-rose-600">
          <WarningCircle className="mt-px h-4 w-4 shrink-0" weight="fill" />
          {error}
        </p>
      )}

      {home && !engineAvailable && !noLeads && (
        <p className="mt-2.5 flex items-start justify-center gap-1.5 px-1 text-center text-[12px] text-neutral-500">
          <Info className="mt-px h-3.5 w-3.5 shrink-0 text-amber-500" weight="fill" />
          The research engine isn&apos;t configured, so Gennie can select and rank leads but not research them.
        </p>
      )}

      {noLeads && (
        <div className="mt-6 flex flex-col items-start gap-3 rounded-xl border border-dashed border-neutral-200 bg-neutral-50/60 p-4 sm:flex-row sm:items-center">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white ring-1 ring-neutral-200">
            <UploadSimple className="h-4 w-4 text-neutral-600" weight="duotone" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-medium text-neutral-900">You have no leads yet</p>
            <p className="text-[12px] text-neutral-500">Add or import some and Gennie can work on them.</p>
          </div>
          <Link href="/dashboard/leads" className={buttonClasses({ variant: "secondary" })}>
            Add leads <ArrowRight className="h-3.5 w-3.5" weight="bold" />
          </Link>
        </div>
      )}

      {home && !noLeads && canPlan && suggestions.length > 0 && (
        <Suggestions suggestions={suggestions} disabled={busy} onPick={pickSuggestion} />
      )}
    </div>
  );
}
