import CompareTemplate from "@/components/landing/CompareTemplate";

export default function CompareClayPage() {
  return (
    <CompareTemplate
      competitorName="Clay"
      competitorShort="Clay"
      tagline="Clay is a strong tool for data enrichment and list building. LeadGennie builds on top of that idea by running the outreach workflow itself — filtering, personalizing and sequencing."
      theirLabel="Clay focuses on:"
      theirBullets={[
        { title: "Lead enrichment", desc: "Aggregating data from many providers." },
        { title: "Workflow building", desc: "Custom table cells and builder macros." },
        { title: "Data operations", desc: "Cleaning lists and scraping websites." },
      ]}
      ourLabel="LeadGennie focuses on:"
      ourBullets={[
        { title: "Prompt-driven filters", desc: "Describe your ICP in plain language." },
        { title: "Personalized outreach", desc: "Context-aware email and LinkedIn drafts." },
        { title: "Sequence execution", desc: "Runs the actual send, not just the data prep." },
        { title: "Reply tracking", desc: "Keeps activity and replies visible in one place." },
      ]}
      tableRows={[
        { feature: "Data enrichment", their: "Yes (multi-provider waterfall)", ours: "Yes, from prompt-driven filters", oursHighlight: true },
        { feature: "Outbound sending", their: "No — requires external tools", ours: "Yes, through your own mailbox", oursHighlight: true },
        { feature: "AI content", their: "Raw prompts in table cells", ours: "Structured drafts you review", oursHighlight: true },
        { feature: "CRM integration", their: "Manual mapping needed", ours: "HubSpot today, more on the roadmap", oursHighlight: true },
        { feature: "Execution model", their: "Manual table runs", ours: "Reviewable AI-built workflow", oursHighlight: true },
      ]}
      whyHeading="Why teams pair LeadGennie with Clay"
      whyParagraphs={[
        "Clay is excellent for sourcing and shaping contact data, but it leaves the actual outreach — writing, sending, tracking — to other tools that you have to stitch together yourself.",
        "LeadGennie picks up from there: it takes a defined audience, drafts context-aware messages grounded in real signals, and runs the send through your connected mailbox and LinkedIn — with every step reviewable before it goes out.",
      ]}
    />
  );
}
