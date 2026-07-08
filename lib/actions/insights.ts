"use server";

import { auth } from "@/auth";
import { sql } from "@/lib/db/client";

async function requireOwnerEmail() {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) throw new Error("Not authenticated");
  return email;
}

type CampaignRow = { status: string; sent_count: number; replied_count: number };
type SendRow = {
  channel: string;
  status: string;
  scheduled_at: string;
  sent_at: string | null;
  lead_id: number;
};

export type StatCardData = { label: string; value: string; sub: string };
export type ChartSeries = { name: string; color: string; values: number[] };
export type ChartData = { labels: string[]; series: ChartSeries[] };

export type InsightBoardData = {
  campaignCount: number;
  campaignMetrics: StatCardData[];
  leadMetrics: StatCardData[];
  outreachOverTime: ChartData;
  dailyStatusBreakdown: ChartData;
  channelBreakdown: ChartData;
};

const COLORS = {
  blue: "#3987e5",
  aqua: "#199e70",
  yellow: "#c98500",
  violet: "#9085e9",
};

function last7Days() {
  const days: { key: string; label: string }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    days.push({
      key: d.toISOString().slice(0, 10),
      label: d.toLocaleDateString("en-US", { weekday: "short" }),
    });
  }
  return days;
}

function dayKey(iso: string | null) {
  return iso ? iso.slice(0, 10) : null;
}

export async function getInsightBoardData(): Promise<InsightBoardData> {
  const owner = await requireOwnerEmail();

  const [campaignRows, sendRows, leadCountRows, segmentCountRows, csvCountRows] = await Promise.all([
    sql`select status, sent_count, replied_count from campaigns where owner_email = ${owner}`,
    sql`
      select cs.channel, cs.status, cs.scheduled_at, cs.sent_at, cs.lead_id
      from campaign_sends cs
      join campaigns c on c.id = cs.campaign_id
      where c.owner_email = ${owner}
    `,
    sql`select count(*)::int as count from leads where owner_email = ${owner}`,
    sql`select count(*)::int as count from segments where owner_email = ${owner}`,
    sql`select count(*)::int as count from leads where owner_email = ${owner} and source = 'csv'`,
  ]);

  const campaigns = campaignRows as CampaignRow[];
  const sends = sendRows as SendRow[];
  const leadTotal = (leadCountRows[0]?.count as number) ?? 0;
  const segmentTotal = (segmentCountRows[0]?.count as number) ?? 0;
  const csvCount = (csvCountRows[0]?.count as number) ?? 0;

  const campaignsTotal = campaigns.length;
  const campaignsRunning = campaigns.filter((c) => c.status === "running").length;
  const sentTotal = campaigns.reduce((acc, c) => acc + c.sent_count, 0);
  const repliedTotal = campaigns.reduce((acc, c) => acc + c.replied_count, 0);
  const replyRate = sentTotal > 0 ? ((repliedTotal / sentTotal) * 100).toFixed(1) : "0.0";

  const pendingCount = sends.filter((s) => s.status === "pending").length;
  const sentCount = sends.filter((s) => s.status === "sent").length;
  const linkedinQueuedCount = sends.filter((s) => s.channel === "linkedin_dm" && s.status === "queued").length;
  const reachedLeads = new Set(
    sends.filter((s) => s.status === "sent" || s.status === "queued").map((s) => s.lead_id)
  ).size;

  const campaignMetrics: StatCardData[] = [
    { label: "Active Campaigns", value: String(campaignsRunning), sub: `${campaignsTotal} total` },
    { label: "Sends Scheduled", value: String(pendingCount), sub: "queued for delivery" },
    { label: "Total Sent", value: String(sentCount), sub: "across all channels" },
    { label: "Reply Rate", value: `${replyRate}%`, sub: `${repliedTotal} replies / ${sentTotal} sent` },
    { label: "LinkedIn Queued", value: String(linkedinQueuedCount), sub: "waiting on extension" },
  ];

  const notReached = Math.max(leadTotal - reachedLeads, 0);
  const leadMetrics: StatCardData[] = [
    { label: "Total Leads", value: leadTotal.toLocaleString(), sub: "loaded in platform" },
    {
      label: "Leads Reached",
      value: reachedLeads.toLocaleString(),
      sub: leadTotal > 0 ? `${((reachedLeads / leadTotal) * 100).toFixed(1)}% of total` : "0% of total",
    },
    { label: "Not Reached", value: notReached.toLocaleString(), sub: "not yet in a sequence" },
    { label: "Segments Created", value: segmentTotal.toLocaleString(), sub: "AI-built audiences" },
    {
      label: "Imported via CSV",
      value: csvCount.toLocaleString(),
      sub: leadTotal > 0 ? `${((csvCount / leadTotal) * 100).toFixed(1)}% of total` : "0% of total",
    },
  ];

  const days = last7Days();
  const labels = days.map((d) => d.label);

  const sentByDay = days.map(
    (d) => sends.filter((s) => s.status === "sent" && dayKey(s.sent_at) === d.key).length
  );

  const scheduledSentByDay = days.map(
    (d) => sends.filter((s) => dayKey(s.scheduled_at) === d.key && s.status === "sent").length
  );
  const scheduledQueuedByDay = days.map(
    (d) => sends.filter((s) => dayKey(s.scheduled_at) === d.key && s.status === "queued").length
  );
  const scheduledPendingByDay = days.map(
    (d) => sends.filter((s) => dayKey(s.scheduled_at) === d.key && s.status === "pending").length
  );

  const emailSentByDay = days.map(
    (d) => sends.filter((s) => s.channel === "email" && s.status === "sent" && dayKey(s.sent_at) === d.key).length
  );
  const linkedinSentByDay = days.map(
    (d) =>
      sends.filter((s) => s.channel === "linkedin_dm" && s.status === "queued" && dayKey(s.scheduled_at) === d.key)
        .length
  );

  return {
    campaignCount: campaignsTotal,
    campaignMetrics,
    leadMetrics,
    outreachOverTime: {
      labels,
      series: [{ name: "Sent", color: COLORS.blue, values: sentByDay }],
    },
    dailyStatusBreakdown: {
      labels,
      series: [
        { name: "Sent", color: COLORS.blue, values: scheduledSentByDay },
        { name: "Queued (LinkedIn)", color: COLORS.violet, values: scheduledQueuedByDay },
        { name: "Scheduled", color: COLORS.yellow, values: scheduledPendingByDay },
      ],
    },
    channelBreakdown: {
      labels,
      series: [
        { name: "Email Sent", color: COLORS.blue, values: emailSentByDay },
        { name: "LinkedIn Queued", color: COLORS.aqua, values: linkedinSentByDay },
      ],
    },
  };
}
