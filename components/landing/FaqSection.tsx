"use client";

import { useId, useState } from "react";
import { CaretDown } from "@phosphor-icons/react/ssr";
import { cn } from "@/lib/utils";
import { Container, SectionHeading } from "./LandingPrimitives";

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

function FaqItem({ q, a, open, onToggle }: { q: string; a: string; open: boolean; onToggle: () => void }) {
  const id = useId();
  return (
    <div>
      <h3>
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          aria-controls={id}
          className="flex w-full items-center justify-between gap-4 py-5 text-left text-[15px] font-medium text-neutral-900 transition-colors hover:text-neutral-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/40"
        >
          {q}
          <span className={cn("flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-neutral-400 ring-1 ring-inset ring-neutral-200 transition-transform duration-300", open && "rotate-180 text-neutral-700")}>
            <CaretDown className="h-3 w-3" weight="bold" />
          </span>
        </button>
      </h3>
      <div id={id} role="region" aria-hidden={!open} className={cn("grid transition-[grid-template-rows,opacity] duration-300 ease-out", open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0")}>
        <div className="overflow-hidden">
          <p className="max-w-2xl pb-5 pr-10 text-[14px] leading-relaxed text-neutral-600">{a}</p>
        </div>
      </div>
    </div>
  );
}

export default function FaqSection() {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <section id="resources" className="scroll-mt-16 py-20 md:py-28">
      <Container>
        <div className="grid gap-4 lg:grid-cols-[0.8fr_1.2fr] lg:gap-16">
          <SectionHeading layout="stack" eyebrow="FAQ" title="Clear answers before you try it." className="lg:sticky lg:top-24 lg:mb-0 lg:self-start" />
          <div className="divide-y divide-neutral-200/80 border-y border-neutral-200/80">
            {FAQS.map((f, i) => (
              <FaqItem key={f.q} q={f.q} a={f.a} open={open === i} onToggle={() => setOpen((cur) => (cur === i ? null : i))} />
            ))}
          </div>
        </div>
      </Container>
    </section>
  );
}
