import CompareTemplate from "@/components/landing/CompareTemplate";

export default function CompareInstantlyPage() {
  return (
    <CompareTemplate
      competitorName="Instantly"
      competitorShort="Instantly"
      tagline="Instantly focuses on bulk email delivery and inbox warming infrastructure. LeadGennie combines mailbox-based sending with AI-led prospecting, personalization and multi-channel workflows."
      theirLabel="Instantly is optimized for:"
      theirBullets={[
        { title: "Email sending", desc: "Bulk SMTP connections at scale." },
        { title: "Inbox warming", desc: "Automated domain warming pools." },
        { title: "Mailbox management", desc: "Managing many sending addresses." },
      ]}
      ourLabel="LeadGennie is optimized for:"
      ourBullets={[
        { title: "Prompt-driven prospecting", desc: "Automatic lead filtering and research." },
        { title: "Multi-channel sequencing", desc: "Email + LinkedIn in one workflow." },
        { title: "Lead qualification", desc: "Scores prospects against intent signals." },
        { title: "CRM sync", desc: "Feeds activity back to HubSpot." },
      ]}
      tableRows={[
        { feature: "Focus", their: "Sending scale / infrastructure", ours: "AI-led outbound workflow" },
        { feature: "LinkedIn support", their: "No — email only", ours: "Yes, integrated in sequences", oursHighlight: true },
        { feature: "Personalization", their: "Template spintax", ours: "Context-aware AI drafts", oursHighlight: true },
        { feature: "CRM integration", their: "Requires Zapier or APIs", ours: "HubSpot today, more on the roadmap", oursHighlight: true },
        { feature: "Sending", their: "Dedicated sending infrastructure", ours: "Through your own connected mailbox", oursHighlight: true },
      ]}
      whyHeading="Why teams pair LeadGennie with Instantly-style sending"
      whyParagraphs={[
        "Instantly is built for sending scale, but it leaves sourcing, qualifying and writing the actual content to the operator.",
        "LeadGennie handles that layer: it qualifies leads against real signals, drafts messages grounded in company context, coordinates LinkedIn alongside email, and keeps activity synced back to your CRM — while sending stays mailbox-based to protect deliverability.",
      ]}
    />
  );
}
