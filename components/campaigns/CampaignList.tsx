"use client";

import { useState } from "react";
import { Funnel } from "@phosphor-icons/react/ssr";
import { cn } from "@/lib/utils";
import type { Campaign, CampaignStatus } from "@/lib/actions/campaigns";
import EmptyState from "@/components/ui/EmptyState";
import CampaignCard from "./CampaignCard";
import { CAMPAIGN_ROW_GRID, CAMPAIGN_STATUS, CAMPAIGN_STATUS_ORDER } from "./campaign-status";

type Filter = "all" | CampaignStatus;

/** Status filter pills + the full-bleed campaigns list. Filtering is client-side over the loaded list. */
export default function CampaignList({ campaigns, canApprove }: { campaigns: Campaign[]; canApprove: boolean }) {
  const [filter, setFilter] = useState<Filter>("all");

  const counts = campaigns.reduce<Partial<Record<CampaignStatus, number>>>((acc, c) => {
    acc[c.status] = (acc[c.status] ?? 0) + 1;
    return acc;
  }, {});
  const filters: { key: Filter; label: string; count: number }[] = [
    { key: "all", label: "All", count: campaigns.length },
    ...CAMPAIGN_STATUS_ORDER.filter((s) => counts[s]).map((s) => ({ key: s, label: CAMPAIGN_STATUS[s].label, count: counts[s] ?? 0 })),
  ];
  const visible = filter === "all" ? campaigns : campaigns.filter((c) => c.status === filter);

  return (
    <>
      <div className="flex flex-wrap items-center gap-1 border-b border-neutral-200/80 px-4 py-2.5 md:px-6" role="tablist" aria-label="Campaign status">
        {filters.map((f) => {
          const on = f.key === filter;
          return (
            <button
              key={f.key}
              type="button"
              role="tab"
              aria-selected={on}
              onClick={() => setFilter(f.key)}
              className={cn(
                "inline-flex h-7 items-center gap-1.5 rounded-md px-2.5 text-[13px] font-medium transition-colors",
                on ? "bg-neutral-900 text-white" : "text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900",
              )}
            >
              {f.label}
              <span className={cn("rounded px-1 text-[11px] tabular-nums", on ? "bg-white/20" : "bg-neutral-100 text-neutral-500")}>{f.count}</span>
            </button>
          );
        })}
      </div>

      <div
        className={cn(
          "hidden border-b border-neutral-200/80 bg-neutral-50/60 px-4 py-2 text-xs font-medium text-neutral-500 md:px-6",
          CAMPAIGN_ROW_GRID,
        )}
      >
        <span>Campaign</span>
        <span>Status</span>
        <span className="text-right">Leads</span>
        <span className="text-right">Sent</span>
        <span className="text-right">Replies</span>
        <span className="text-right">Created</span>
        <span className="sr-only">Actions</span>
      </div>

      {visible.length === 0 ? (
        <EmptyState compact icon={Funnel} title="No campaigns match this filter" description="Pick another status above to see the rest." />
      ) : (
        <ul className="divide-y divide-neutral-100 border-b border-neutral-100">
          {visible.map((c) => (
            <CampaignCard key={c.id} campaign={c} canApprove={canApprove} />
          ))}
        </ul>
      )}
    </>
  );
}
