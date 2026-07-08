// Mock data for the Module 1 Insight Board. Replace with live API data
// once the CRM Core / Signal Monitoring backends are wired up.

export const chartColors = {
  blue: "#3987e5",
  aqua: "#199e70",
  yellow: "#c98500",
  green: "#008300",
  violet: "#9085e9",
  red: "#e66767",
};

export const outreachOverTime = {
  labels: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
  series: [{ name: "Email Msg", color: chartColors.blue, values: [120, 210, 340, 480, 560, 610, 690] }],
};

export const dailyTotalOutreach = {
  labels: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
  series: [
    { name: "Daily Outreach", color: chartColors.aqua, values: [42, 58, 51, 66, 72, 39, 48] },
    { name: "Completed", color: chartColors.blue, values: [30, 44, 40, 52, 60, 30, 36] },
    { name: "Awaiting Response", color: chartColors.yellow, values: [8, 10, 7, 9, 8, 6, 7] },
    { name: "Queued", color: chartColors.violet, values: [4, 4, 4, 5, 4, 3, 5] },
  ],
};

export const engagementMetrics = {
  labels: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
  series: [
    { name: "Email Click", color: chartColors.blue, values: [12, 18, 15, 22, 26, 14, 17] },
    { name: "Email Reply", color: chartColors.green, values: [4, 6, 5, 8, 9, 5, 6] },
  ],
};

export const campaignMetrics = [
  { label: "Leads Outreach Planned", value: "248", sub: "+12% vs yesterday", icon: "handshake" as const },
  { label: "Total Leads Reached", value: "5,530", sub: "across all channels", icon: "bar-chart-3" as const },
  { label: "Engagement (Today/Total)", value: "38 / 612", sub: "chat & target", icon: "target" as const },
  { label: "LI Acceptance Rate", value: "42.8%", sub: "invites accepted", icon: "link-2" as const },
  { label: "Reply Rates (Email/LI)", value: "6.1% / 9.4%", sub: "replies per message", icon: "reply" as const },
];

export const leadMetrics = [
  { label: "Total Leads", value: "5,532", sub: "loaded in platform", icon: "users" as const },
  { label: "Outreached", value: "4,120", sub: "74.5% of total", icon: "check-square" as const },
  { label: "Engaged", value: "612", sub: "11.1% engagement rate", icon: "zap" as const },
  { label: "Not Outreached", value: "1,412", sub: "pending queue", icon: "hourglass" as const },
  { label: "Email Opened", value: "1,890", sub: "34.2% open rate", icon: "mail" as const },
];

export const accountMetrics = [
  { label: "Total Accounts", value: "812", sub: "unique organizations", icon: "building-2" as const },
  { label: "Enriched", value: "634", sub: "78.1% complete profiles", icon: "check-square" as const },
  { label: "With Active Deals", value: "196", sub: "24.1% in pipeline", icon: "briefcase" as const },
];

export const dealMetrics = [
  { label: "Total Pipeline", value: "$1.24M", sub: "active deal value", icon: "dollar-sign" as const },
  { label: "Avg Deal Size", value: "$6,340", sub: "probability-weighted", icon: "bar-chart-3" as const },
  { label: "Won Deals", value: "58", sub: "31.4% win rate", icon: "trophy" as const },
  { label: "Open Deals", value: "127", sub: "current opportunities", icon: "hourglass" as const },
];

export const signalMetrics = [
  { label: "High Confidence", value: "94", sub: "verified intent signals", icon: "shield" as const },
  { label: "Actioned", value: "61", sub: "processed by agents", icon: "zap" as const },
  { label: "Converted", value: "23", sub: "handed off to CRM", icon: "refresh-cw" as const },
];
