"use client";

import { useState } from "react";
import type { ChartData } from "@/lib/actions/insights";
import Card, { CardHeader } from "@/components/ui/Card";
import { Segmented } from "@/components/ui/NavTabs";
import LineChartCard from "./charts/LineChartCard";
import BarChartCard from "./charts/BarChartCard";

type View = "sent" | "status" | "channel";

/** One card, three real views of the last 7 days of outreach. */
export default function OutreachCard({ sent, status, channel }: { sent: ChartData; status: ChartData; channel: ChartData }) {
  const [view, setView] = useState<View>("sent");
  const current = view === "sent" ? sent : view === "status" ? status : channel;
  const empty = current.series.every((s) => s.values.every((v) => v === 0));
  return (
    <Card className="lg:col-span-2">
      <CardHeader
        title="Outreach"
        description="Last 7 days, counted from sends"
        action={
          <Segmented
            value={view}
            onChange={setView}
            options={[
              { value: "sent", label: "Sent" },
              { value: "status", label: "By status" },
              { value: "channel", label: "By channel" },
            ]}
          />
        }
      />
      <div className="relative px-4 pb-4 pt-3">
        {view === "sent" && <LineChartCard bare labels={sent.labels} series={sent.series} />}
        {view === "status" && <BarChartCard bare labels={status.labels} series={status.series} />}
        {view === "channel" && <BarChartCard bare labels={channel.labels} series={channel.series} />}
        {empty && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/60 text-center backdrop-blur-[1px]">
            <p className="text-[13px] font-medium text-neutral-700">No sends in the last 7 days</p>
            <p className="mt-1 text-xs text-neutral-400">Launch a campaign and this fills in as messages go out.</p>
          </div>
        )}
      </div>
    </Card>
  );
}
