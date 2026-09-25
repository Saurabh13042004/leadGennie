"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Check, CircleNotch, Clock, EnvelopeSimple, Pause, Play, Warning, X } from "@phosphor-icons/react/ssr";
import { cn } from "@/lib/utils";
import { changeCampaignState, decideCampaignLaunch } from "@/lib/actions/campaign-builder";
import type { CampaignListItem } from "@/lib/domain/campaigns/read-model";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import { CAMPAIGN_ROW_GRID, CAMPAIGN_STATUS } from "./campaign-status";

const NOT_LAUNCHED = new Set(["draft", "pending_approval", "ready", "rejected"]);

const when = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : null;

/**
 * One campaign in the campaigns list: status, name, real lead/send counts, next email, and the approve/reject or
 * pause/resume shortcuts. Only real counts — "—" where nothing has happened yet, and no reply rate (replies aren't
 * tracked until inbox sync exists). The name opens the campaign page, where everything else lives.
 */
export default function CampaignCard({ campaign: c, canApprove }: { campaign: CampaignListItem; canApprove: boolean }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const meta = CAMPAIGN_STATUS[c.status];
  const launched = !NOT_LAUNCHED.has(c.status);
  const leads = launched ? c.audienceSize.toLocaleString() : "—";
  const sent = launched ? c.sent.toLocaleString() : "—";
  const replied = c.replied === null ? "—" : c.replied.toLocaleString();
  const next = when(c.nextSendAt);
  const building = c.status === "draft" || c.status === "rejected";

  function run(work: () => Promise<{ ok: boolean; error?: { message: string } }>) {
    setError(null);
    startTransition(async () => {
      const res = await work();
      if (!res.ok) setError(res.error?.message ?? "Something went wrong.");
      router.refresh();
    });
  }

  return (
    <li className={cn("group relative px-4 py-3 transition-colors hover:bg-neutral-50/80 md:px-6", CAMPAIGN_ROW_GRID)}>
      <div className="flex min-w-0 items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <Link href={`/dashboard/campaigns/${c.id}`} className="truncate text-[13px] font-medium text-neutral-900 underline-offset-2 hover:underline">
              {c.name}
            </Link>
            <Badge tone={meta.tone} dot pulse={meta.pulse} className="md:hidden">{meta.label}</Badge>
          </div>
          <div className="mt-0.5 flex min-w-0 items-center gap-1.5 text-xs text-neutral-500">
            <EnvelopeSimple className="h-3.5 w-3.5 shrink-0 text-neutral-400" weight="duotone" aria-label="Email" />
            <span className="truncate">{c.steps} email step{c.steps === 1 ? "" : "s"}{c.sendModel === "legacy" ? " · created with the old wizard" : ""}</span>
            {c.pausedReason && <span className="truncate text-amber-700" title={c.pausedReason}>· {c.pausedReason}</span>}
            {launched && c.excluded > 0 && (
              <span className="inline-flex shrink-0 items-center gap-1 text-amber-700">
                <span className="text-neutral-300">·</span>
                <Warning className="h-3 w-3" weight="fill" />
                {c.excluded} excluded
              </span>
            )}
          </div>
          {error && <p className="mt-1 text-xs text-rose-600">{error}</p>}
          <p className="mt-1 text-xs tabular-nums text-neutral-500 md:hidden">
            {leads} leads · {sent} sent · {replied} replied{next ? ` · next ${next}` : ""}
          </p>
        </div>
      </div>

      <div className="hidden md:block">
        <Badge tone={meta.tone} dot pulse={meta.pulse}>{meta.label}</Badge>
      </div>
      <Metric value={leads} muted={!launched} />
      <Metric value={sent} muted={!launched || c.sent === 0} />
      <Metric value={replied} muted={c.replied === null} />
      <span className="hidden text-right text-xs tabular-nums text-neutral-500 md:block">{next ?? "—"}</span>

      <div className="mt-2 flex items-center justify-start gap-1 md:mt-0 md:justify-end">
        {c.status === "pending_approval" && c.approvalId ? (
          canApprove ? (
            <>
              <Button variant="primary" size="xs" onClick={() => run(() => decideCampaignLaunch(c.approvalId, "approved"))} disabled={isPending}>
                {isPending ? <CircleNotch className="h-3.5 w-3.5 animate-spin" weight="bold" /> : <Check className="h-3.5 w-3.5" weight="bold" />}
                Approve
              </Button>
              <Button variant="danger" size="xs" onClick={() => run(() => decideCampaignLaunch(c.approvalId, "rejected"))} disabled={isPending}>
                <X className="h-3.5 w-3.5" weight="bold" />
                Reject
              </Button>
            </>
          ) : (
            <span className="inline-flex items-center gap-1.5 text-xs text-neutral-500">
              <Clock className="h-3.5 w-3.5" weight="duotone" />
              Waiting on owner/admin
            </span>
          )
        ) : c.status === "running" || c.status === "paused" ? (
          <div className={cn("flex items-center gap-1 transition-opacity", isPending ? "opacity-100" : "md:opacity-0 md:focus-within:opacity-100 md:group-hover:opacity-100")}>
            <Button variant="secondary" size="xs" onClick={() => run(() => changeCampaignState(c.id, c.status === "running" ? "pause" : "resume"))} disabled={isPending}>
              {isPending ? (
                <CircleNotch className="h-3.5 w-3.5 animate-spin" weight="bold" />
              ) : c.status === "running" ? (
                <Pause className="h-3.5 w-3.5" weight="fill" />
              ) : (
                <Play className="h-3.5 w-3.5" weight="fill" />
              )}
              {c.status === "running" ? "Pause" : "Resume"}
            </Button>
          </div>
        ) : null}
        <Link
          href={building ? `/dashboard/campaigns/${c.id}/edit` : `/dashboard/campaigns/${c.id}`}
          title={building ? "Continue building" : "Open campaign"}
          aria-label={building ? "Continue building" : "Open campaign"}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-neutral-400 transition-all hover:bg-neutral-100 hover:text-neutral-900"
        >
          <ArrowRight className="h-4 w-4" weight="bold" />
        </Link>
      </div>
    </li>
  );
}

function Metric({ value, muted }: { value: string; muted?: boolean }) {
  return <span className={cn("hidden text-right text-[13px] tabular-nums md:block", muted ? "text-neutral-400" : "text-neutral-900")}>{value}</span>;
}
