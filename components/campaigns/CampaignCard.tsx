"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Play, Pause, ArrowUpRight, Loader2, Check, X, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { updateCampaignStatus, type Campaign } from "@/lib/actions/campaigns";
import { decideApproval } from "@/lib/actions/approvals";

const STATUS_STYLES: Record<Campaign["status"], string> = {
  running: "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200",
  paused: "bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-200",
  pending_approval: "bg-indigo-50 text-indigo-700 ring-1 ring-inset ring-indigo-200",
  rejected: "bg-rose-50 text-rose-700 ring-1 ring-inset ring-rose-200",
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
    <div className="rounded-2xl border border-neutral-200 bg-white p-5 flex flex-col gap-4 hover:border-neutral-300 transition-colors">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-neutral-900 font-semibold truncate">{campaign.name}</h3>
          <p className="text-xs text-neutral-500 mt-1">created {createdLabel}</p>
        </div>
        <span className={cn("text-xs font-medium rounded-full px-2.5 py-1 shrink-0", STATUS_STYLES[status])}>
          {STATUS_LABEL[status]}
        </span>
      </div>

      <div className="grid grid-cols-4 gap-2 text-center rounded-xl bg-neutral-50 py-3">
        <div>
          <p className="text-sm font-bold text-neutral-900 tabular-nums">{campaign.total_leads.toLocaleString()}</p>
          <p className="text-[11px] text-neutral-500 mt-0.5">Leads</p>
        </div>
        <div>
          <p className="text-sm font-bold text-neutral-900 tabular-nums">{campaign.sent_count.toLocaleString()}</p>
          <p className="text-[11px] text-neutral-500 mt-0.5">Sent</p>
        </div>
        <div>
          <p className="text-sm font-bold text-neutral-900 tabular-nums">{campaign.replied_count.toLocaleString()}</p>
          <p className="text-[11px] text-neutral-500 mt-0.5">Replied</p>
        </div>
        <div>
          <p className="text-sm font-bold text-emerald-600 tabular-nums">{campaign.reply_rate}%</p>
          <p className="text-[11px] text-neutral-500 mt-0.5">Reply rate</p>
        </div>
      </div>

      {campaign.blocked_count > 0 && (
        <p className="text-xs text-amber-700">{campaign.blocked_count} lead(s) excluded by compliance rules</p>
      )}
      {decisionError && <p className="text-xs text-rose-600">{decisionError}</p>}

      <div className="flex items-center gap-2 pt-1 border-t border-neutral-100">
        {status === "pending_approval" ? (
          canApprove ? (
            <>
              <button
                onClick={() => handleDecision("approved")}
                disabled={isPending}
                className="flex-1 flex items-center justify-center gap-1.5 text-sm text-white bg-neutral-900 hover:bg-neutral-800 rounded-lg px-3 py-2 transition-colors disabled:opacity-50"
              >
                {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                Approve
              </button>
              <button
                onClick={() => handleDecision("rejected")}
                disabled={isPending}
                className="flex items-center justify-center gap-1.5 text-sm text-rose-600 bg-rose-50 border border-rose-200 hover:bg-rose-100 rounded-lg px-3 py-2 transition-colors disabled:opacity-50"
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
            className="flex-1 flex items-center justify-center gap-1.5 text-sm text-neutral-700 bg-white border border-neutral-200 hover:bg-neutral-50 hover:border-neutral-300 rounded-lg px-3 py-2 transition-colors disabled:opacity-50"
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
          className="flex items-center gap-1.5 text-sm text-neutral-500 hover:text-neutral-900 rounded-lg px-3 py-2 transition-colors"
        >
          View analytics
          <ArrowUpRight className="w-3.5 h-3.5" />
        </Link>
      </div>
    </div>
  );
}
