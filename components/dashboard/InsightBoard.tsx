"use client";

import { useState } from "react";
import { Gauge, Search, ChevronDown, X } from "lucide-react";
import { cn } from "@/lib/utils";
import StatCard from "./StatCard";
import LineChartCard from "./charts/LineChartCard";
import BarChartCard from "./charts/BarChartCard";
import {
  outreachOverTime,
  dailyTotalOutreach,
  engagementMetrics,
  campaignMetrics,
  leadMetrics,
  accountMetrics,
  dealMetrics,
  signalMetrics,
} from "@/lib/mock/insight-board";

const TABS = ["Campaigns", "Leads", "Accounts", "Deals", "Signals"] as const;
type Tab = (typeof TABS)[number];

export default function InsightBoard({ userCompany }: { userCompany?: string | null }) {
  const [tab, setTab] = useState<Tab>("Campaigns");
  const [approvalDismissed, setApprovalDismissed] = useState(false);

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center shrink-0">
          <Gauge className="w-5 h-5 text-blue-400" />
        </div>
        <div>
          <h1 className="text-xl font-semibold text-white">
            {userCompany ?? "Juntrax Solutions"} Sales Agent Insight Board
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
        {["Tags", "Status: Active", "Updated By: All Users", "Approval: All", "Sort By: Date"].map((f) => (
          <button
            key={f}
            className="flex items-center gap-1 text-sm text-neutral-400 hover:text-white border border-white/10 rounded-lg px-3 py-1.5 transition-colors"
          >
            {f}
            <ChevronDown className="w-3.5 h-3.5" />
          </button>
        ))}
        <span className="text-xs text-neutral-500 ml-auto whitespace-nowrap">1 of 1 campaigns</span>
      </div>

      {tab === "Campaigns" && (
        <div className="space-y-6">
          {!approvalDismissed && (
            <div className="flex items-center justify-between gap-4 rounded-xl border border-yellow-500/30 bg-yellow-500/10 px-4 py-3">
              <p className="text-sm text-yellow-200">1 campaign is waiting for approval</p>
              <div className="flex items-center gap-2 shrink-0">
                <button className="text-sm font-medium text-yellow-100 bg-yellow-500/20 hover:bg-yellow-500/30 rounded-lg px-3 py-1.5 transition-colors">
                  Show Them
                </button>
                <button
                  onClick={() => setApprovalDismissed(true)}
                  className="text-yellow-200/60 hover:text-yellow-100"
                  aria-label="Dismiss"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            {campaignMetrics.map((m) => (
              <StatCard key={m.label} label={m.label} value={m.value} sub={m.sub} icon={m.icon} />
            ))}
          </div>

          <div className="rounded-xl border border-white/10 bg-[#0A0A0A] p-4 flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-xs font-semibold text-white">
                JS
              </div>
              <div>
                <p className="text-sm text-white">New Campaign</p>
                <p className="text-xs text-neutral-500">about 1 hour ago</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-yellow-300 border border-yellow-500/40 rounded-full px-3 py-1">
                PENDING APPROVALS
              </span>
              <span className="text-xs font-medium text-black bg-green-400 rounded-full px-3 py-1">
                ACTIVE
              </span>
            </div>
          </div>

          <LineChartCard title="Outreach Over Time" labels={outreachOverTime.labels} series={outreachOverTime.series} />
          <BarChartCard title="Daily & Total Outreach" labels={dailyTotalOutreach.labels} series={dailyTotalOutreach.series} />
          <BarChartCard title="Engagement Metrics" labels={engagementMetrics.labels} series={engagementMetrics.series} />
        </div>
      )}

      {tab === "Leads" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {leadMetrics.map((m) => (
            <StatCard key={m.label} label={m.label} value={m.value} sub={m.sub} icon={m.icon} />
          ))}
        </div>
      )}

      {tab === "Accounts" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {accountMetrics.map((m) => (
            <StatCard key={m.label} label={m.label} value={m.value} sub={m.sub} icon={m.icon} />
          ))}
        </div>
      )}

      {tab === "Deals" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {dealMetrics.map((m) => (
            <StatCard key={m.label} label={m.label} value={m.value} sub={m.sub} icon={m.icon} />
          ))}
        </div>
      )}

      {tab === "Signals" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {signalMetrics.map((m) => (
            <StatCard key={m.label} label={m.label} value={m.value} sub={m.sub} icon={m.icon} />
          ))}
        </div>
      )}
    </div>
  );
}
