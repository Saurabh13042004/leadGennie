import { esc, button, paragraph, renderLayout, screenshot, step, type EmailContent } from "./layout";

const firstName = (name: string) => name.trim().split(/\s+/)[0] || "there";

/** Sent once, right after a person creates an account. Says only what the product really does — no numbers, no promises. */
export function welcomeEmail(input: { name: string; baseUrl: string }): EmailContent {
  const first = firstName(input.name);
  const dashboard = `${input.baseUrl}/dashboard`;
  const steps: [string, string][] = [
    ["Add your leads", "Import a CSV or add people one by one. Duplicates are merged for you."],
    ["Connect your work mailbox", "Under Settings → Mailboxes, sign in with the Google or Microsoft mailbox you already use — no DNS setup."],
    ["Research and personalise", "LeadGennie only writes about things it can back with a source it found, and shows you which."],
    ["Review, approve, launch", "Nothing is sent until you approve the campaign, and anyone who unsubscribes is never emailed again."],
  ];
  const body =
    paragraph(`Hi ${esc(first)}, your workspace is ready. LeadGennie is an outbound operator: it finds and researches prospects, drafts emails from verified evidence, and sends only after you say so.`) +
    paragraph("The quickest way to a first campaign:") +
    `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 8px;">${steps.map(([t, d], i) => step(i + 1, t, d)).join("")}</table>` +
    button("Open your workspace", dashboard) +
    screenshot(`${input.baseUrl}/email/welcome-campaign.png`, "A LeadGennie campaign page showing enrolled leads, sent and delivered counts, limits and schedule", "A campaign in LeadGennie: who is enrolled, what has gone out, and its limits and schedule. Sample data.") +
    paragraph(`Questions? Just reply to this email.`);
  return {
    subject: `Welcome to LeadGennie, ${first}`,
    html: renderLayout({
      preheader: "Your workspace is ready — here's the fastest way to your first campaign.",
      heading: `Welcome, ${first}.`,
      body,
      footer: `You're receiving this because an account was created with this email address on LeadGennie.`,
    }),
    text: [
      `Welcome to LeadGennie, ${first}.`,
      "",
      "Your workspace is ready. LeadGennie finds and researches prospects, drafts emails from verified evidence, and sends only after you approve.",
      "",
      "The quickest way to a first campaign:",
      ...steps.map(([t, d], i) => `${i + 1}. ${t} — ${d}`),
      "",
      `Open your workspace: ${dashboard}`,
      "",
      "Questions? Just reply to this email.",
    ].join("\n"),
  };
}
