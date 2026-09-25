"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowClockwise, CircleNotch, SkipForward, WarningOctagon } from "@phosphor-icons/react/ssr";
import { retrySendAction, skipSendAction } from "@/lib/actions/sending";
import type { CampaignDetail } from "@/lib/domain/campaigns/read-model";
import Card, { CardHeader } from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";

/**
 * Emails that failed for good (a bad address, a rejected message, retries exhausted) with what the provider said, and what to do:
 * retry now, or skip this one and let the rest of the sequence carry on. Shown only when there is something to act on.
 */
export default function SendIssuesCard({ failed, deadJobs, canAct }: { failed: CampaignDetail["failedSends"]; deadJobs: CampaignDetail["deadJobs"]; canAct: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  if (failed.length === 0 && deadJobs.length === 0) return null;

  function act(key: string, work: () => Promise<{ ok: boolean; error?: { message: string } }>) {
    setError(null);
    setBusy(key);
    start(async () => {
      const res = await work();
      setBusy(null);
      if (!res.ok) return setError(res.error?.message ?? "Something went wrong.");
      router.refresh();
    });
  }

  return (
    <Card className="ring-1 ring-inset ring-rose-200/70">
      <CardHeader
        title={<span className="flex items-center gap-1.5"><WarningOctagon className="h-4 w-4 text-rose-600" weight="fill" />Sending issues</span>}
        description="These emails didn't go out. Nothing is retried silently — you decide."
        action={<Badge tone="rose">{failed.length} failed</Badge>}
      />
      {error && <p role="alert" className="border-b border-neutral-100 px-4 py-2 text-[13px] text-rose-600">{error}</p>}
      <ul className="divide-y divide-neutral-100">
        {failed.map((f) => (
          <li key={f.sendId} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3">
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-medium text-neutral-900">
                <Link href={`/dashboard/leads`} className="hover:underline">{f.leadName}</Link>
                <span className="font-normal text-neutral-400"> · email {f.step}{f.email ? ` · ${f.email}` : ""}</span>
              </p>
              <p className="mt-0.5 text-xs leading-relaxed text-rose-700">{f.error}</p>
            </div>
            {canAct && (
              <div className="flex items-center gap-1.5">
                <Button variant="secondary" size="xs" disabled={pending} onClick={() => act(`r${f.sendId}`, () => retrySendAction(f.sendId))}>
                  {busy === `r${f.sendId}` ? <CircleNotch className="h-3.5 w-3.5 animate-spin" weight="bold" /> : <ArrowClockwise className="h-3.5 w-3.5" weight="bold" />} Retry
                </Button>
                <Button variant="ghost" size="xs" disabled={pending} onClick={() => act(`s${f.sendId}`, () => skipSendAction(f.sendId))}>
                  {busy === `s${f.sendId}` ? <CircleNotch className="h-3.5 w-3.5 animate-spin" weight="bold" /> : <SkipForward className="h-3.5 w-3.5" weight="bold" />} Skip
                </Button>
              </div>
            )}
          </li>
        ))}
      </ul>
      {deadJobs.length > 0 && (
        <div className="border-t border-neutral-100 px-4 py-3 text-xs text-neutral-500">
          {deadJobs.length} background job{deadJobs.length === 1 ? "" : "s"} for this campaign gave up after repeated errors. The most recent: <span className="text-neutral-700">{deadJobs[0].error || "unknown error"}</span>
        </div>
      )}
    </Card>
  );
}
