const FAQS = [
  {
    q: "What is LeadGennie?",
    a: "LeadGennie is an AI-led GTM tool for SMBs that helps teams generate, enrich, personalize and execute outbound workflows across email and LinkedIn.",
  },
  {
    q: "Can I describe my ICP with a prompt?",
    a: "Yes. The dashboard supports prompt-driven filters so you can describe the audience you want and use the resulting criteria to work with leads.",
  },
  {
    q: "Can LeadGennie build the campaign flow for me?",
    a: "Yes. The AI agent can create the workflow from a natural-language goal, and you can review and adjust the flow for the campaign.",
  },
  {
    q: "Which outbound channels are live?",
    a: "Email and LinkedIn are live in the beta. Phone/calling, SMS and WhatsApp are upcoming rather than current live channels.",
  },
  {
    q: "What happens to CRM data?",
    a: "LeadGennie can work with HubSpot today, with more CRM connectors on the roadmap. Enriched data can be reviewed before being pushed back, depending on the workflow.",
  },
  {
    q: "Does LeadGennie provide the email sending infrastructure?",
    a: "No. Outreach is sent through your connected Gmail / Outlook mailbox. LeadGennie handles campaign logic, personalization and sending controls around that mailbox.",
  },
];

export default function FaqSection() {
  return (
    <section id="resources" className="py-20">
      <div className="mx-auto max-w-6xl px-5">
        <div className="mb-14">
          <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.14em] text-neutral-400">FAQ</p>
          <h2 className="max-w-xl text-4xl font-extrabold leading-[1.03] tracking-[-0.03em] text-neutral-900 sm:text-5xl">
            Clear answers before you try it.
          </h2>
        </div>

        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {FAQS.map((faq) => (
            <details
              key={faq.q}
              className="group rounded-xl border border-neutral-200 bg-white px-5 py-4 open:border-neutral-300"
            >
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-bold text-neutral-900">
                {faq.q}
                <span className="shrink-0 text-neutral-400 transition-transform group-open:rotate-45">+</span>
              </summary>
              <p className="mt-3 text-[13px] leading-relaxed text-neutral-500">{faq.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
