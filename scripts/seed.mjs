import { neon } from "@neondatabase/serverless";

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is not set");
  process.exit(1);
}

const sql = neon(process.env.DATABASE_URL);
const owner = "demo@leadgennie.ai";

const existing = await sql`select count(*)::int as count from campaigns where owner_email = ${owner}`;
if (existing[0].count > 0) {
  console.log("Demo campaigns already exist, skipping seed.");
  process.exit(0);
}

const campaigns = [
  {
    name: "Q3 SaaS – India ICP",
    status: "running",
    audience_label: "Indian SaaS — Series B+",
    channels: ["email", "linkedin"],
    total_leads: 1248,
    sent_count: 1020,
    replied_count: 246,
  },
  {
    name: "Series A Founders – US",
    status: "running",
    audience_label: "US Fintech founders",
    channels: ["email", "linkedin"],
    total_leads: 642,
    sent_count: 410,
    replied_count: 88,
  },
  {
    name: "CTO outreach EMEA",
    status: "paused",
    audience_label: "MNC CTOs — EMEA",
    channels: ["email"],
    total_leads: 318,
    sent_count: 318,
    replied_count: 54,
  },
  {
    name: "Fintech APAC – Re-engage",
    status: "draft",
    audience_label: "All qualified leads",
    channels: ["email"],
    total_leads: 0,
    sent_count: 0,
    replied_count: 0,
  },
];

for (const c of campaigns) {
  await sql`
    insert into campaigns (owner_email, name, status, audience_label, channels, total_leads, sent_count, replied_count, from_email)
    values (${owner}, ${c.name}, ${c.status}, ${c.audience_label}, ${c.channels}, ${c.total_leads}, ${c.sent_count}, ${c.replied_count}, 'jane@leadforge.io')
  `;
  console.log("Seeded campaign:", c.name);
}

console.log("Seed complete.");
