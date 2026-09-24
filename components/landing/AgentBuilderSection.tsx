const FLOW_STEPS = [
  { num: "01", title: "Find the right accounts", desc: "Apply prompt-based filters to discover the audience." },
  { num: "02", title: "Enrich + qualify", desc: "Use available data and signals to deepen lead context." },
  { num: "03", title: "Engage + monitor", desc: "Run email and LinkedIn steps, then react to replies and signals." },
];

// Anchor points in a shared 0-100 x, 0-60 y virtual coordinate space —
// both the SVG connectors and the node boxes below use these same
// coordinates (via a matching viewBox and %-based CSS position), so the
// lines always terminate exactly at each node regardless of container size.
const NODES = [
  { label: "INPUT", title: "Find SaaS buyers", x: 18, y: 10 },
  { label: "ENRICH", title: "Company + POC data", x: 66, y: 24 },
  { label: "INTENT", title: "Hiring / funding / activity", x: 18, y: 38 },
  { label: "OUTREACH", title: "Email + LinkedIn sequence", x: 66, y: 52 },
];

const CONNECTORS = [
  "M18,10 Q45,6 66,24",
  "M66,24 Q40,32 18,38",
  "M18,38 Q45,44 66,52",
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
              className="relative h-[420px] overflow-hidden rounded-xl border border-neutral-200 bg-neutral-50"
              style={{
                backgroundImage:
                  "linear-gradient(transparent 31px, #e5e5e5 32px), linear-gradient(90deg, transparent 31px, #e5e5e5 32px)",
                backgroundSize: "32px 32px",
              }}
            >
              <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 60" preserveAspectRatio="none">
                <defs>
                  <linearGradient id="agentFlowGradient" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor="#6366f1" />
                    <stop offset="100%" stopColor="#d946ef" />
                  </linearGradient>
                  <marker id="agentFlowArrow" markerWidth="6" markerHeight="6" refX="3" refY="3" orient="auto">
                    <path d="M0,0 L6,3 L0,6 Z" fill="#a78bfa" />
                  </marker>
                </defs>
                {CONNECTORS.map((d, i) => (
                  <path
                    key={i}
                    d={d}
                    fill="none"
                    stroke="url(#agentFlowGradient)"
                    strokeWidth="0.6"
                    strokeLinecap="round"
                    markerEnd="url(#agentFlowArrow)"
                    vectorEffect="non-scaling-stroke"
                  />
                ))}
              </svg>

              {NODES.map((node) => (
                <div
                  key={node.label}
                  className="absolute min-w-[170px] -translate-x-1/2 -translate-y-1/2 rounded-xl border border-neutral-200 bg-white p-3 shadow-[0_10px_28px_rgba(79,70,229,0.12)]"
                  style={{ left: `${node.x}%`, top: `${(node.y / 60) * 100}%` }}
                >
                  <p className="mb-1 text-[8px] font-bold uppercase tracking-widest text-indigo-500">{node.label}</p>
                  <p className="text-[12px] font-bold text-neutral-800">{node.title}</p>
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
