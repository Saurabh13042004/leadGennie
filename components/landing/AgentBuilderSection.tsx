import { Container, Eyebrow, GennieMark } from "./LandingPrimitives";
import AgentPlanCard from "./AgentPlanCard";

const FLOW_STEPS = [
  { num: "01", title: "Find the right accounts", desc: "Apply prompt-based filters to discover the audience." },
  { num: "02", title: "Enrich + qualify", desc: "Use available data and signals to deepen lead context." },
  { num: "03", title: "Engage + monitor", desc: "Run email and LinkedIn steps, then react to replies and signals." },
];

export default function AgentBuilderSection() {
  return (
    <section className="py-20 md:py-28">
      <Container>
        <div className="grid items-center gap-12 lg:grid-cols-[0.95fr_1.05fr] lg:gap-16">
          <div>
            <Eyebrow className="mb-3 flex items-center gap-2">
              <GennieMark size="sm" />
              AI agent builder
            </Eyebrow>
            <h2 className="text-[32px] font-semibold leading-[1.08] tracking-[-0.03em] text-neutral-950 sm:text-[40px] md:text-[44px]">
              Give the agent the goal.
              <br />
              <span className="bg-gradient-to-r from-indigo-600 via-violet-600 to-fuchsia-600 bg-clip-text text-transparent">Shape the flow.</span>
            </h2>
            <p className="mt-4 max-w-md text-[16px] leading-relaxed text-neutral-600 md:text-[17px]">
              LeadGennie can turn one natural-language instruction into a multi-step GTM workflow. You can then review
              and edit the flow before or during execution.
            </p>

            <ol className="mt-8 divide-y divide-neutral-200/80 border-y border-neutral-200/80">
              {FLOW_STEPS.map((step) => (
                <li key={step.num} className="flex items-start gap-4 py-4">
                  <span className="mt-0.5 font-mono text-[12px] font-medium tabular-nums text-violet-600">{step.num}</span>
                  <div>
                    <p className="text-[15px] font-medium text-neutral-900">{step.title}</p>
                    <p className="mt-0.5 text-[14px] leading-relaxed text-neutral-500">{step.desc}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>

          <div className="relative flex items-center justify-center overflow-hidden rounded-2xl border border-neutral-200/80 bg-[#f7f7f6] px-4 py-10 sm:px-10 sm:py-14">
            <div
              className="pointer-events-none absolute inset-0 [mask-image:radial-gradient(ellipse_at_center,black_30%,transparent_75%)]"
              style={{ backgroundImage: "radial-gradient(rgba(0,0,0,0.12) 1px, transparent 1px)", backgroundSize: "18px 18px" }}
            />
            <div className="pointer-events-none absolute left-1/2 top-1/2 h-72 w-72 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,rgba(139,92,246,0.22),rgba(217,70,239,0.08)_50%,transparent_70%)] blur-2xl" />
            <div className="relative w-full">
              <AgentPlanCard />
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}
