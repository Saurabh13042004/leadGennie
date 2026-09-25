"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import {
  ChartLineUp,
  Check,
  CircleNotch,
  Clock,
  EnvelopeSimple,
  LinkedinLogo,
  Pause,
  Play,
  Warning,
  X,
} from "@phosphor-icons/react/ssr";
import { cn } from "@/lib/utils";
import { updateCampaignStatus, type Campaign } from "@/lib/actions/campaigns";
import { decideApproval } from "@/lib/actions/approvals";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import { CAMPAIGN_ROW_GRID, CAMPAIGN_STATUS, channelFamilies } from "./campaign-status";

/**
 * One campaign in the campaigns list: status, name + audience/channels, lead/send/reply numbers, and the
 * pause/resume or approve/reject actions. (File name kept from the old card layout.)
 */
export default function CampaignCard({ campaign, canApprove }: { campaign: Campaign; canApprove: boolean }) {
  const [status, setStatus] = useState(campaign.status);
  const [isPending, startTransition] = useTransition();
  const [decisionError, setDecisionError] = useState<string | null>(null);

  function toggleStatus() {
    const next = status === "running" ? "paused" : "running";
    startTransition(async () => {
      await updateCampaignStatus(campaign.id, next);
      setStatus(next);
    });
  }

  function handleDecision(decision: "approved" | "rejected") {
    if (!campaign.approval_id) return;
    setDecisionError(null);
    startTransition(async () => {
      try {
        await decideApproval(campaign.approval_id!, decision);
        setStatus(decision === "approved" ? "running" : "rejected");
      } catch (e) {
        setDecisionError(e instanceof Error ? e.message : "Could not record decision");
      }
    });
  }

  const created = new Date(campaign.created_at);
  const createdLabel = created.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  const meta = CAMPAIGN_STATUS[status];
  const families = channelFamilies(campaign.channels);
  const totalLeads = Number(campaign.total_leads);
  const sent = Number(campaign.sent_count);
  const replied = Number(campaign.replied_count);
  const replyRate = Number(campaign.reply_rate);
  const blocked = Number(campaign.blocked_count);

  return (
    <li className={cn("group relative px-4 py-3 transition-colors hover:bg-neutral-50/80 md:px-6", CAMPAIGN_ROW_GRID)}>
      {/* Name + audience/channels */}
      <div className="flex min-w-0 items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate text-[13px] font-medium text-neutral-900">{campaign.name}</p>
            <Badge tone={meta.tone} dot pulse={meta.pulse} className="md:hidden">
              {meta.label}
            </Badge>
          </div>
          <div className="mt-0.5 flex min-w-0 items-center gap-1.5 text-xs text-neutral-500">
            <span className="flex shrink-0 items-center gap-1 text-neutral-400">
              {families.includes("email") && <EnvelopeSimple className="h-3.5 w-3.5" weight="duotone" aria-label="Email" />}
              {families.includes("linkedin") && <LinkedinLogo className="h-3.5 w-3.5" weight="duotone" aria-label="LinkedIn" />}
            </span>
            <span className="truncate">{campaign.audience_label || "No audience label"}</span>
            {blocked > 0 && (
              <span className="inline-flex shrink-0 items-center gap-1 text-amber-700">
                <span className="text-neutral-300">·</span>
                <Warning className="h-3 w-3" weight="fill" />
                {blocked} lead(s) excluded by compliance rules
              </span>
            )}
          </div>
          {decisionError && <p className="mt-1 text-xs text-rose-600">{decisionError}</p>}
          {/* Compact metrics for small screens */}
          <p className="mt-1 text-xs tabular-nums text-neutral-500 md:hidden">
            {totalLeads.toLocaleString()} leads · {sent.toLocaleString()} sent · {replied.toLocaleString()} replied ({replyRate}%) · {createdLabel}
          </p>
        </div>
      </div>

      <div className="hidden md:block">
        <Badge tone={meta.tone} dot pulse={meta.pulse}>
          {meta.label}
        </Badge>
      </div>

      <Metric value={totalLeads.toLocaleString()} />
      <Metric value={sent.toLocaleString()} muted={sent === 0} />
      <div className="hidden text-right md:block">
        <span className={cn("text-[13px] tabular-nums", replied === 0 ? "text-neutral-400" : "text-neutral-900")}>
          {replied.toLocaleString()}
        </span>
        <span className={cn("ml-1.5 text-xs tabular-nums", replyRate > 0 ? "text-emerald-600" : "text-neutral-400")}>{replyRate}%</span>
      </div>
      <time dateTime={created.toISOString()} className="hidden text-right text-xs tabular-nums text-neutral-400 md:block">
        {createdLabel}
      </time>

      {/* Actions */}
      <div className="mt-2 flex items-center justify-start gap-1 md:mt-0 md:justify-end">
        {status === "pending_approval" ? (
          canApprove ? (
            <>
              <Button variant="primary" size="xs" onClick={() => handleDecision("approved")} disabled={isPending}>
                {isPending ? <CircleNotch className="h-3.5 w-3.5 animate-spin" weight="bold" /> : <Check className="h-3.5 w-3.5" weight="bold" />}
                Approve
              </Button>
              <Button variant="danger" size="xs" onClick={() => handleDecision("rejected")} disabled={isPending}>
                <X className="h-3.5 w-3.5" weight="bold" />
                Reject
              </Button>
            </>
          ) : (
            <span className="inline-flex items-center gap-1.5 text-xs text-neutral-500">
              <Clock className="h-3.5 w-3.5" weight="duotone" />
              Waiting on owner/admin approval
            </span>
          )
        ) : status === "rejected" ? (
          <span className="text-xs text-neutral-400">This launch request was rejected.</span>
        ) : (
          <div
            className={cn(
              "flex items-center gap-1 transition-opacity",
              isPending ? "opacity-100" : "md:opacity-0 md:focus-within:opacity-100 md:group-hover:opacity-100",
            )}
          >
            <Button variant="secondary" size="xs" onClick={toggleStatus} disabled={isPending}>
              {isPending ? (
                <CircleNotch className="h-3.5 w-3.5 animate-spin" weight="bold" />
              ) : status === "running" ? (
                <Pause className="h-3.5 w-3.5" weight="fill" />
              ) : (
                <Play className="h-3.5 w-3.5" weight="fill" />
              )}
              {status === "running" ? "Pause" : "Resume"}
            </Button>
          </div>
        )}
        <Link
          href="/dashboard"
          title="View analytics"
          aria-label="View analytics"
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-neutral-400 transition-all hover:bg-neutral-100 hover:text-neutral-900 md:opacity-0 md:focus-visible:opacity-100 md:group-hover:opacity-100"
        >
          <ChartLineUp className="h-4 w-4" weight="duotone" />
        </Link>
      </div>
    </li>
  );
}

function Metric({ value, muted }: { value: string; muted?: boolean }) {
  return <span className={cn("hidden text-right text-[13px] tabular-nums md:block", muted ? "text-neutral-400" : "text-neutral-900")}>{value}</span>;
}
