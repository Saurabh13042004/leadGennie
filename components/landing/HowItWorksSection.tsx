const STEPS = [
  {
    num: "01",
    title: "Define your ICP",
    desc: "Describe your target audience using natural language inside the dashboard.",
  },
  {
    num: "02",
    title: "Find & enrich",
    desc: "Work from CRM, Sheets, CSV, LinkedIn and other connected data sources.",
  },
  {
    num: "03",
    title: "Detect intent",
    desc: "Use signals such as funding, hiring, onboarding and company activity.",
  },
  {
    num: "04",
    title: "Launch outreach",
    desc: "Run personalized email and LinkedIn workflows with follow-ups and branching.",
  },
  {
    num: "05",
    title: "Review & improve",
    desc: "Track lead history, replies, campaign performance and next-step recommendations.",
  },
];

export default function HowItWorksSection() {
  return (
    <section id="how" className="py-20">
      <div className="mx-auto max-w-6xl px-5">
        <div className="mb-14 flex flex-wrap items-end justify-between gap-6">
          <div>
            <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.14em] text-neutral-400">How it works</p>
            <h2 className="max-w-2xl text-4xl font-extrabold leading-[1.03] tracking-[-0.03em] text-neutral-900 sm:text-5xl">
              From lead list to active workflow.
            </h2>
          </div>
          <p className="max-w-sm text-sm leading-relaxed text-neutral-500">
            LeadGennie lets you start from your data or from a prompt, then build the workflow around the goals of
            the campaign.
          </p>
        </div>

        <div className="grid grid-cols-1 divide-y divide-neutral-200 border-y border-neutral-200 sm:grid-cols-2 sm:divide-x sm:divide-y-0 lg:grid-cols-5">
          {STEPS.map((step) => (
            <div key={step.num} className="min-h-[190px] px-6 py-7">
              <div className="mb-6 flex h-8 w-8 items-center justify-center rounded-full border border-indigo-200 bg-indigo-50 text-[11px] font-bold text-indigo-600">
                {step.num}
              </div>
              <h3 className="mb-1.5 text-[15px] font-bold tracking-tight text-neutral-900">{step.title}</h3>
              <p className="text-[12px] leading-relaxed text-neutral-500">{step.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
