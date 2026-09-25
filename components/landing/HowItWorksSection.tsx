import { ChartLineUp, Crosshair, Database, Lightning, PaperPlaneTilt } from "@phosphor-icons/react/ssr";
import { Container, IconTile, SectionHeading } from "./LandingPrimitives";

const STEPS = [
  { num: "01", icon: Crosshair, title: "Define your ICP", desc: "Describe your target audience using natural language inside the dashboard." },
  { num: "02", icon: Database, title: "Find & enrich", desc: "Work from CRM, Sheets, CSV, LinkedIn and other connected data sources." },
  { num: "03", icon: Lightning, title: "Detect intent", desc: "Use signals such as funding, hiring, onboarding and company activity." },
  { num: "04", icon: PaperPlaneTilt, title: "Launch outreach", desc: "Run personalized email and LinkedIn workflows with follow-ups and branching." },
  { num: "05", icon: ChartLineUp, title: "Review & improve", desc: "Track lead history, replies, campaign performance and next-step recommendations." },
];

export default function HowItWorksSection() {
  return (
    <section id="how" className="scroll-mt-16 border-t border-neutral-200/80 py-20 md:py-28">
      <Container>
        <SectionHeading
          eyebrow="How it works"
          title="From lead list to active workflow."
          lead="LeadGennie lets you start from your data or from a prompt, then build the workflow around the goals of the campaign."
        />

        <ol className="grid gap-px overflow-hidden rounded-2xl bg-neutral-200/80 ring-1 ring-neutral-200/80 sm:grid-cols-2 lg:grid-cols-5">
          {STEPS.map((step) => (
            <li key={step.num} className="flex gap-4 bg-white p-5 sm:flex-col sm:gap-0 sm:p-6 sm:last:col-span-2 lg:last:col-span-1">
              <div className="flex items-center justify-between self-start sm:self-stretch">
                <IconTile icon={step.icon} />
                <span className="hidden font-mono text-[11px] font-medium tabular-nums text-neutral-400 sm:inline">{step.num}</span>
              </div>
              <div>
                <h3 className="text-[15px] font-semibold tracking-tight text-neutral-950 sm:mt-6">
                  <span className="mr-2 font-mono text-[11px] font-medium tabular-nums text-neutral-400 sm:hidden">{step.num}</span>
                  {step.title}
                </h3>
                <p className="mt-1.5 text-[13px] leading-relaxed text-neutral-500">{step.desc}</p>
              </div>
            </li>
          ))}
        </ol>
      </Container>
    </section>
  );
}
