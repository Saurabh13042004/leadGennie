"use client";

import { useState } from "react";
import { ArrowRight, Buildings, Check } from "@phosphor-icons/react/ssr";
import BookDemoModal from "@/components/BookDemoModal";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import { cn } from "@/lib/utils";
import { Container, IconTile, SectionHeading } from "./LandingPrimitives";

type Plan = { name: string; price: string; unit?: string; credits: string; features: string[]; highlight?: boolean };

const PLANS: Plan[] = [
  { name: "Free", price: "$0", credits: "100 credits", features: ["Explore the platform", "Build and test workflows", "No credit card required"] },
  {
    name: "Pro",
    price: "$50",
    unit: "/ month / user",
    credits: "5,000 credits included",
    features: ["Email + LinkedIn workflows", "AI lead / campaign flows", "CRM + data enrichment workflows", "$5 per additional 500 credits"],
    highlight: true,
  },
];

function PlanCard({ plan, onCta }: { plan: Plan; onCta: () => void }) {
  return (
    <div
      className={cn(
        "relative flex flex-col rounded-2xl bg-white p-7 md:p-8",
        plan.highlight
          ? "shadow-[0_0_0_1px_rgba(79,70,229,0.35),0_24px_60px_-24px_rgba(79,70,229,0.3)]"
          : "border border-neutral-200/80 shadow-[0_1px_2px_rgba(0,0,0,0.03)]",
      )}
    >
      <div className="flex items-center justify-between">
        <p className="text-[15px] font-semibold text-neutral-950">{plan.name}</p>
        {plan.highlight && <Badge tone="indigo">Beta plan</Badge>}
      </div>
      <p className="mt-5 flex items-baseline gap-1.5">
        <span className="text-[44px] font-semibold leading-none tracking-[-0.035em] text-neutral-950">{plan.price}</span>
        {plan.unit && <span className="text-[14px] text-neutral-500">{plan.unit}</span>}
      </p>
      <p className="mt-2 text-[14px] text-neutral-500">{plan.credits}</p>

      <ul className="my-7 space-y-3 border-t border-neutral-100 pt-7">
        {plan.features.map((f) => (
          <li key={f} className="flex items-start gap-2.5 text-[14px] text-neutral-700">
            <span className={cn("mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full", plan.highlight ? "bg-indigo-600 text-white" : "bg-neutral-100 text-neutral-600")}>
              <Check className="h-2.5 w-2.5" weight="bold" />
            </span>
            {f}
          </li>
        ))}
      </ul>

      <Button variant={plan.highlight ? "primary" : "secondary"} size="md" className="mt-auto h-10 w-full" onClick={onCta}>
        Get Early Access
        {plan.highlight && <ArrowRight className="h-4 w-4" weight="bold" />}
      </Button>
    </div>
  );
}

export default function PricingSection() {
  const [isAccessOpen, setIsAccessOpen] = useState(false);

  return (
    <>
      <section id="pricing" className="scroll-mt-16 border-b border-neutral-200/80 bg-neutral-50/60 py-20 md:py-28">
        <Container>
          <SectionHeading
            layout="center"
            eyebrow="Pricing"
            title="Start small. Scale when the workflow proves itself."
            lead="Beta pricing shown here is based on our planned plan structure and may change before general availability."
          />

          <div className="mx-auto grid max-w-4xl gap-4 md:grid-cols-2">
            {PLANS.map((p) => (
              <PlanCard key={p.name} plan={p} onCta={() => setIsAccessOpen(true)} />
            ))}
          </div>

          <div className="mx-auto mt-4 flex max-w-4xl items-start gap-3 rounded-2xl border border-neutral-200/80 bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
            <IconTile icon={Buildings} size="sm" />
            <p className="text-[14px] leading-relaxed text-neutral-600">
              <span className="font-medium text-neutral-900">Enterprise / custom</span> · Contact us to discuss higher-volume
              requirements and workflow needs. Enterprise pricing is not finalized yet.
            </p>
          </div>
        </Container>
      </section>

      <BookDemoModal isOpen={isAccessOpen} onClose={() => setIsAccessOpen(false)} />
    </>
  );
}
