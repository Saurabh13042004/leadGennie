import type { ReactNode } from "react";
import { Container, SectionHeading } from "./LandingPrimitives";
import { DraftMini, PromptFilterMini, SequenceMini } from "./ProductSurfaceMinis";

const CARDS: { num: string; label: string; title: string; desc: string; mini: ReactNode }[] = [
  {
    num: "01",
    label: "Prospecting",
    title: "Prompt-driven lead filters",
    desc: "Describe the audience in plain language and use the resulting filters in the dashboard.",
    mini: <PromptFilterMini />,
  },
  {
    num: "02",
    label: "Personalization",
    title: "Context-aware outreach",
    desc: "Use lead, company and intent context to create relevant email and LinkedIn touchpoints at volume.",
    mini: <DraftMini />,
  },
  {
    num: "03",
    label: "Multi-channel",
    title: "Email + LinkedIn campaigns",
    desc: "Build the whole sequence in one flow, including connection steps, messages, follow-ups and response handling.",
    mini: <SequenceMini />,
  },
];

export default function ProductSurface() {
  return (
    <section id="solutions" className="scroll-mt-16 border-y border-neutral-200/80 bg-neutral-50/60 py-20 md:py-28">
      <Container>
        <SectionHeading
          eyebrow="Product surface"
          title="The work your GTM team actually does."
          lead="No fake benchmarks. No placeholder customer logos. The UI focuses on the workflows that exist in the beta."
        />

        <div className="grid gap-4 lg:grid-cols-3">
          {CARDS.map((c) => (
            <article key={c.num} className="flex flex-col overflow-hidden rounded-2xl border border-neutral-200/80 bg-white shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
              <div className="p-6 pb-5">
                <p className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-wider text-neutral-500">
                  <span className="font-mono tabular-nums text-indigo-600">{c.num}</span>
                  {c.label}
                </p>
                <h3 className="mt-3 text-[19px] font-semibold tracking-tight text-neutral-950">{c.title}</h3>
                <p className="mt-2 text-[14px] leading-relaxed text-neutral-600">{c.desc}</p>
              </div>
              <div className="flex-1 border-t border-neutral-200/80 bg-[#f7f7f6] p-4 md:p-5">{c.mini}</div>
            </article>
          ))}
        </div>
      </Container>
    </section>
  );
}
