"use client";

import { useState } from "react";
import { Gauge, Search, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import StatCard from "./StatCard";
import LineChartCard from "./charts/LineChartCard";
import BarChartCard from "./charts/BarChartCard";
import type { InsightBoardData } from "@/lib/actions/insights";

const TABS = ["Campaigns", "Leads", "Accounts", "Deals", "Signals"] as const;
type Tab = (typeof TABS)[number];

function iconFor(label: string) {
  const map: Record<string, "handshake" | "bar-chart-3" | "target" | "link-2" | "reply" | "users" | "check-square" | "zap" | "hourglass" | "mail"> = {
    "Active Campaigns": "handshake",
    "Sends Scheduled": "hourglass",
    "Total Sent": "bar-chart-3",
    "Reply Rate": "reply",
    "LinkedIn Queued": "link-2",
    "Total Leads": "users",
    "Leads Reached": "check-square",
    "Not Reached": "hourglass",
    "Segments Created": "target",
    "Imported via CSV": "mail",
  };
  return map[label] ?? "zap";
}

function EmptyModuleState({ title }: { title: string }) {
  return (
    <div className="rounded-xl border border-dashed border-white/15 bg-[#0A0A0A] flex flex-col items-center justify-center text-center py-20 px-6">
      <p className="text-white font-medium">{title} isn&apos;t built yet</p>
      <p className="text-sm text-neutral-500 mt-1 max-w-sm">
        This module doesn&apos;t exist in the product yet, so there&apos;s no real data to show — check the{" "}
        {title} page in the sidebar for status.
      </p>
    </div>
  );
}

export default function InsightBoard({
  userCompany,
  data,
}: {
  userCompany?: string | null;
  data: InsightBoardData;
}) {
  const [tab, setTab] = useState<Tab>("Campaigns");

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center shrink-0">
          <Gauge className="w-5 h-5 text-blue-400" />
        </div>
        <div>
          <h1 className="text-xl font-semibold text-white">
            {userCompany ?? "Your"} Sales Agent Insight Board
          </h1>
          <p className="text-sm text-neutral-500">Tracking Touchpoints Sent and Connections Won Over Time</p>
        </div>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              "px-4 py-1.5 rounded-full text-sm font-medium transition-colors border",
              tab === t
                ? "bg-blue-500/10 border-blue-500/30 text-white"
                : "border-white/10 text-neutral-400 hover:text-white hover:bg-white/5"
            )}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-2 flex-wrap rounded-xl border border-white/10 bg-[#0A0A0A] p-3">
        <div className="flex items-center gap-2 bg-white/5 rounded-lg px-3 py-1.5 flex-1 min-w-[160px]">
          <Search className="w-4 h-4 text-neutral-500" />
          <input
            placeholder="Search"
            className="bg-transparent text-sm text-white placeholder:text-neutral-600 focus:outline-none w-full"
          />
        </div>
        {["Tags", "Status: Active", "Updated By: All Users", "Sort By: Date"].map((f) => (
          <button
            key={f}
            className="flex items-center gap-1 text-sm text-neutral-400 hover:text-white border border-white/10 rounded-lg px-3 py-1.5 transition-colors"
          >
            {f}
            <ChevronDown className="w-3.5 h-3.5" />
          </button>
        ))}
        <span className="text-xs text-neutral-500 ml-auto whitespace-nowrap">
          {data.campaignCount} campaign{data.campaignCount === 1 ? "" : "s"}
        </span>
      </div>

      {tab === "Campaigns" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            {data.campaignMetrics.map((m) => (
              <StatCard key={m.label} label={m.label} value={m.value} sub={m.sub} icon={iconFor(m.label)} />
            ))}
          </div>

          <LineChartCard
            title="Outreach Over Time"
            labels={data.outreachOverTime.labels}
            series={data.outreachOverTime.series}
          />
          <BarChartCard
            title="Daily & Total Outreach"
            labels={data.dailyStatusBreakdown.labels}
            series={data.dailyStatusBreakdown.series}
          />
          <BarChartCard
            title="Sends by Channel"
            labels={data.channelBreakdown.labels}
            series={data.channelBreakdown.series}
          />
        </div>
      )}

      {tab === "Leads" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {data.leadMetrics.map((m) => (
            <StatCard key={m.label} label={m.label} value={m.value} sub={m.sub} icon={iconFor(m.label)} />
          ))}
        </div>
      )}

      {tab === "Accounts" && <EmptyModuleState title="Accounts" />}
      {tab === "Deals" && <EmptyModuleState title="Deals" />}
      {tab === "Signals" && <EmptyModuleState title="Signal Monitoring" />}
    </div>
  );
}
