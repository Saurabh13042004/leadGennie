const FLOW_STEPS = [
  { num: "01", title: "Find the right accounts", desc: "Apply prompt-based filters to discover the audience." },
  { num: "02", title: "Enrich + qualify", desc: "Use available data and signals to deepen lead context." },
  { num: "03", title: "Engage + monitor", desc: "Run email and LinkedIn steps, then react to replies and signals." },
];

const NODES = [
  { label: "INPUT", title: "Find SaaS buyers", align: "start" as const },
  { label: "ENRICH", title: "Company + POC data", align: "end" as const },
  { label: "INTENT", title: "Hiring / funding / activity", align: "start" as const },
  { label: "OUTREACH", title: "Email + LinkedIn sequence", align: "end" as const },
];

export default function AgentBuilderSection() {
  return (
    <section className="py-20">
      <div className="mx-auto max-w-6xl px-5">
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="rounded-2xl border border-neutral-200 bg-white p-8">
            <p className="mb-3 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.14em] text-neutral-400">
              <span className="h-1.5 w-1.5 rounded-full bg-indigo-500" />
              AI agent builder
            </p>
            <h2 className="mb-4 text-4xl font-extrabold leading-[1.02] tracking-[-0.03em] text-neutral-900">
              Give the agent the goal.
              <br />
              <span className="text-indigo-600">Shape the flow.</span>
            </h2>
            <p className="mb-7 text-sm leading-relaxed text-neutral-500">
              LeadGennie can turn one natural-language instruction into a multi-step GTM workflow. You can then
              review and edit the flow before or during execution.
            </p>
            <div className="flex flex-col gap-3">
              {FLOW_STEPS.map((step) => (
                <div key={step.num} className="flex items-start gap-3 rounded-xl border border-neutral-200 bg-neutral-50 p-3.5">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-neutral-200 bg-white text-[10px] font-bold text-neutral-500">
                    {step.num}
                  </div>
                  <div>
                    <p className="text-[12px] font-bold text-neutral-800">{step.title}</p>
                    <p className="text-[11px] leading-relaxed text-neutral-500">{step.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-neutral-200 bg-white p-6">
            <div
              className="flex flex-col gap-3 rounded-xl border border-neutral-200 bg-neutral-50 p-6"
              style={{
                backgroundImage:
                  "linear-gradient(transparent 31px, #e5e5e5 32px), linear-gradient(90deg, transparent 31px, #e5e5e5 32px)",
                backgroundSize: "32px 32px",
              }}
            >
              {NODES.map((node, i) => (
                <div key={node.label} className="flex flex-col">
                  <div className={`flex ${node.align === "end" ? "justify-end" : "justify-start"}`}>
                    <div className="min-w-[170px] rounded-xl border border-neutral-200 bg-white p-3 shadow-sm">
                      <p className="mb-1 text-[8px] font-bold uppercase tracking-widest text-neutral-400">
                        {node.label}
                      </p>
                      <p className="text-[12px] font-bold text-neutral-800">{node.title}</p>
                    </div>
                  </div>
                  {i < NODES.length - 1 && (
                    <div className={`flex py-1 ${node.align === "end" ? "justify-end pr-10" : "justify-start pl-10"}`}>
                      <div className="h-5 w-px bg-gradient-to-b from-indigo-400 to-violet-400" />
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="mt-3 rounded-lg border border-neutral-200 bg-neutral-50 p-2.5 text-[11px] text-neutral-500">
              <span className="font-bold text-neutral-800">Review before execution</span> · workflow steps can be
              adjusted based on your team&apos;s process.
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
