"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Play, Pause, ArrowUpRight, Loader2, Check, X, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { updateCampaignStatus, type Campaign } from "@/lib/actions/campaigns";
import { decideApproval } from "@/lib/actions/approvals";

const STATUS_STYLES: Record<Campaign["status"], string> = {
  running: "bg-blue-500/10 text-blue-300 border-blue-500/20",
  paused: "bg-yellow-500/10 text-yellow-300 border-yellow-500/20",
  pending_approval: "bg-purple-500/10 text-purple-300 border-purple-500/20",
  rejected: "bg-red-500/10 text-red-300 border-red-500/20",
};

const STATUS_LABEL: Record<Campaign["status"], string> = {
  running: "Running",
  paused: "Paused",
  pending_approval: "Pending approval",
  rejected: "Rejected",
};

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

  const createdLabel = new Date(campaign.created_at).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });

  return (
    <div className="rounded-xl border border-white/10 bg-[#0A0A0A] p-5 flex flex-col gap-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-white font-medium">{campaign.name}</h3>
          <p className="text-xs text-neutral-500 mt-1">created {createdLabel}</p>
        </div>
        <span className={cn("text-xs border rounded-full px-2.5 py-1 shrink-0", STATUS_STYLES[status])}>
          {STATUS_LABEL[status]}
        </span>
      </div>

      <div className="grid grid-cols-4 gap-2 text-center">
        <div>
          <p className="text-sm font-semibold text-white tabular-nums">{campaign.total_leads.toLocaleString()}</p>
          <p className="text-[11px] text-neutral-500 mt-0.5">Leads</p>
        </div>
        <div>
          <p className="text-sm font-semibold text-white tabular-nums">{campaign.sent_count.toLocaleString()}</p>
          <p className="text-[11px] text-neutral-500 mt-0.5">Sent</p>
        </div>
        <div>
          <p className="text-sm font-semibold text-white tabular-nums">{campaign.replied_count.toLocaleString()}</p>
          <p className="text-[11px] text-neutral-500 mt-0.5">Replied</p>
        </div>
        <div>
          <p className="text-sm font-semibold text-green-400 tabular-nums">{campaign.reply_rate}%</p>
          <p className="text-[11px] text-neutral-500 mt-0.5">Reply rate</p>
        </div>
      </div>

      {campaign.blocked_count > 0 && (
        <p className="text-xs text-yellow-400/80">{campaign.blocked_count} lead(s) excluded by compliance rules</p>
      )}
      {decisionError && <p className="text-xs text-red-400">{decisionError}</p>}

      <div className="flex items-center gap-2 pt-1 border-t border-white/5">
        {status === "pending_approval" ? (
          canApprove ? (
            <>
              <button
                onClick={() => handleDecision("approved")}
                disabled={isPending}
                className="flex-1 flex items-center justify-center gap-1.5 text-sm text-black bg-white hover:bg-neutral-200 rounded-lg px-3 py-2 transition-colors disabled:opacity-50"
              >
                {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                Approve
              </button>
              <button
                onClick={() => handleDecision("rejected")}
                disabled={isPending}
                className="flex items-center justify-center gap-1.5 text-sm text-red-300 bg-red-500/10 hover:bg-red-500/20 rounded-lg px-3 py-2 transition-colors disabled:opacity-50"
              >
                <X className="w-3.5 h-3.5" />
                Reject
              </button>
            </>
          ) : (
            <p className="flex-1 flex items-center gap-1.5 text-sm text-neutral-500">
              <Clock className="w-3.5 h-3.5" />
              Waiting on owner/admin approval
            </p>
          )
        ) : status === "rejected" ? (
          <p className="flex-1 text-sm text-neutral-500">This launch request was rejected.</p>
        ) : (
          <button
            onClick={toggleStatus}
            disabled={isPending}
            className="flex-1 flex items-center justify-center gap-1.5 text-sm text-white bg-white/5 hover:bg-white/10 rounded-lg px-3 py-2 transition-colors disabled:opacity-50"
          >
            {isPending ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : status === "running" ? (
              <Pause className="w-3.5 h-3.5" />
            ) : (
              <Play className="w-3.5 h-3.5" />
            )}
            {status === "running" ? "Pause" : "Resume"}
          </button>
        )}
        <Link
          href="/dashboard"
          className="flex items-center gap-1.5 text-sm text-neutral-400 hover:text-white rounded-lg px-3 py-2 transition-colors"
        >
          View analytics
          <ArrowUpRight className="w-3.5 h-3.5" />
        </Link>
      </div>
    </div>
  );
}
