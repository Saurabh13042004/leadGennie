import CompareTemplate from "@/components/landing/CompareTemplate";

export default function CompareHubspotPage() {
  return (
    <CompareTemplate
      competitorName="HubSpot"
      competitorShort="HubSpot"
      tagline="HubSpot is an industry-standard CRM and inbound marketing platform. LeadGennie is an AI-led outbound layer that connects to HubSpot rather than replacing it."
      theirLabel="HubSpot is optimized for:"
      theirBullets={[
        { title: "Customer CRM", desc: "Central system of record for leads and customers." },
        { title: "Inbound pipelines", desc: "Sourcing and managing organic website leads." },
        { title: "Sales pipelines", desc: "Custom deal stages and manual workflows." },
      ]}
      ourLabel="LeadGennie is optimized for:"
      ourBullets={[
        { title: "Outbound workflows", desc: "Prompt-driven prospecting and AI-built sequences." },
        { title: "Personalized drafts", desc: "Context-aware copy grounded in real signals." },
        { title: "Multi-channel outreach", desc: "Email and LinkedIn in one workflow." },
        { title: "CRM sync", desc: "Works alongside your existing HubSpot data." },
      ]}
      tableRows={[
        { feature: "Platform category", their: "CRM / inbound marketing", ours: "AI-led outbound workflow" },
        { feature: "Outbound prospecting", their: "Manual sales sequences", ours: "Prompt-driven filters + AI drafts", oursHighlight: true },
        { feature: "Personalization", their: "Basic template tokens", ours: "Context-aware generative copy", oursHighlight: true },
        { feature: "CRM integration", their: "Native system of record", ours: "Connects to your HubSpot data", oursHighlight: true },
        { feature: "Setup", their: "Can take real customization time", ours: "Beta onboarding in minutes", oursHighlight: true },
      ]}
      whyHeading="Why teams pair LeadGennie with HubSpot"
      whyParagraphs={[
        "LeadGennie doesn't aim to replace HubSpot — it sits next to it as the outbound execution layer.",
        "Instead of your team manually building lists, drafting templates and tracking sends by hand, LeadGennie handles the prompt-driven filtering, AI-assisted personalization and multi-channel sequencing, while your HubSpot workspace stays the system of record.",
      ]}
    />
  );
}
