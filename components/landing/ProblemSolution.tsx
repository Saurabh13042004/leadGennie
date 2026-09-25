import { ChartLineUp, Funnel, Lightning, PencilSimpleLine, Warning } from "@phosphor-icons/react/ssr";
import { Container, Eyebrow, IconTile } from "./LandingPrimitives";

const SOLUTIONS = [
  { icon: Funnel, title: "Find + enrich", desc: "Use filters or prompts to define the prospects you want." },
  { icon: Lightning, title: "Use real signals", desc: "Surface funding, hiring, onboarding and other company activity." },
  { icon: PencilSimpleLine, title: "Personalize", desc: "Adapt messages to the person, company and relevant context." },
  { icon: ChartLineUp, title: "Track everything", desc: "Keep multi-channel activity, replies and lead history together." },
];

const H3 = "text-[28px] font-semibold leading-[1.1] tracking-[-0.025em] text-neutral-950 md:text-[34px]";

export default function ProblemSolution() {
  return (
    <section id="product" className="scroll-mt-16 py-20 md:py-28">
      <Container>
        <div className="overflow-hidden rounded-2xl border border-neutral-200/80 bg-white shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
          <div className="grid lg:grid-cols-2">
            <div className="flex flex-col bg-neutral-50/70 p-7 md:p-10">
              <Eyebrow className="mb-3">The problem</Eyebrow>
              <h2 className={H3}>Outbound at scale is hard.</h2>
              <p className="mt-4 max-w-md text-[15px] leading-relaxed text-neutral-600">
                Personalization is time-consuming. Signals live in different places. And once you add email and LinkedIn
                together, it gets harder to see the full story.
              </p>
              <div className="mt-8 flex items-start gap-3 rounded-xl bg-white p-4 ring-1 ring-inset ring-neutral-200/80">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-amber-50 text-amber-600 ring-1 ring-inset ring-amber-200/70">
                  <Warning className="h-4 w-4" weight="duotone" />
                </span>
                <div>
                  <p className="text-[14px] font-medium text-neutral-900">More volume can create more noise.</p>
                  <p className="mt-0.5 text-[13px] leading-relaxed text-neutral-500">LeadGennie is designed to keep context attached to the workflow.</p>
                </div>
              </div>
            </div>

            <div className="border-t border-neutral-200/80 p-7 md:p-10 lg:border-l lg:border-t-0">
              <Eyebrow className="mb-3">The solution</Eyebrow>
              <h2 className={H3}>One workflow for the whole motion.</h2>
              <p className="mt-4 max-w-md text-[15px] leading-relaxed text-neutral-600">
                Define your audience with a prompt, enrich and qualify leads, generate hyperpersonalized messaging, run
                LinkedIn and email sequences, and keep the activity visible in one workspace.
              </p>
            </div>
          </div>

          <ul className="grid gap-px border-t border-neutral-200/80 bg-neutral-200/80 grid-cols-2 lg:grid-cols-4">
            {SOLUTIONS.map((s) => (
              <li key={s.title} className="bg-white p-5 md:p-6">
                <IconTile icon={s.icon} size="sm" />
                <p className="mt-4 text-[14px] font-medium text-neutral-900">{s.title}</p>
                <p className="mt-1 text-[13px] leading-relaxed text-neutral-500">{s.desc}</p>
              </li>
            ))}
          </ul>
        </div>
      </Container>
    </section>
  );
}
