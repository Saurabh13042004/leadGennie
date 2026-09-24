import CompareTemplate from "@/components/landing/CompareTemplate";

export default function CompareApolloPage() {
  return (
    <CompareTemplate
      competitorName="Apollo.io"
      competitorShort="Apollo.io"
      tagline="Apollo is a robust database directory for finding contact records. LeadGennie is built as an AI-led outbound system that automates the workflow around those contacts."
      theirLabel="Apollo is optimized for:"
      theirBullets={[
        { title: "Prospect discovery", desc: "Static contact database search." },
        { title: "Filters", desc: "Standard firmographic parameters (employee count, location)." },
        { title: "Manual workflows", desc: "Manually reviewing lists and sequences." },
      ]}
      ourLabel="LeadGennie is optimized for:"
      ourBullets={[
        { title: "Prompt-driven filters", desc: "Describe your ICP in plain language." },
        { title: "AI personalization", desc: "Generates a relevant angle for each lead." },
        { title: "Intent signals", desc: "Surfaces hiring, funding and other activity signals." },
        { title: "Multi-channel workflows", desc: "Email + LinkedIn sequences with follow-ups." },
      ]}
      tableRows={[
        { feature: "Focus area", their: "Lead directory / database", ours: "AI-led outbound workflow" },
        { feature: "ICP targeting", their: "Manual filter attributes", ours: "Prompt-driven filters", oursHighlight: true },
        { feature: "Message writing", their: "Template variables", ours: "Context-aware AI drafts", oursHighlight: true },
        { feature: "Outreach channels", their: "Email & basic calls", ours: "Email + LinkedIn", oursHighlight: true },
        { feature: "CRM sync", their: "Manual export/import", ours: "HubSpot today, more on the roadmap", oursHighlight: true },
      ]}
      whyHeading="Why teams pair LeadGennie with Apollo"
      whyParagraphs={[
        "Apollo is a strong source of contact records, but everyone filtering by the same attributes ends up sending similar generic templates — which hurts reply rates over time.",
        "LeadGennie is the workflow layer around your contacts: describe your audience in a prompt, let the AI agent enrich and qualify leads against real signals, and review personalized drafts before anything sends across email or LinkedIn.",
      ]}
    />
  );
}
