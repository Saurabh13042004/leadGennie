import type { ReactNode } from "react";
import { Crosshair, Info } from "@phosphor-icons/react/ssr";
import Badge from "@/components/ui/Badge";
import Card, { CardHeader } from "@/components/ui/Card";
import Callout from "./Callout";
import type { LeadIntelligence } from "@/lib/intelligence/read-model";

function Block({ title, children, tag }: { title: string; children: ReactNode; tag?: string }) {
  return (
    <div className="grid gap-1 py-3 sm:grid-cols-[150px_1fr] sm:gap-4">
      <h3 className="text-xs font-medium text-neutral-500 sm:pt-px">{title}</h3>
      <div className="min-w-0">
        <p className="text-[13px] leading-relaxed text-neutral-800">{children}</p>
        {tag && <Badge tone="amber" className="mt-1.5">{tag}</Badge>}
      </div>
    </div>
  );
}

/** The outreach strategy. Every factual sentence here was re-verified by the engine; hypotheses are labelled. */
export default function Narrative({ research }: { research: NonNullable<LeadIntelligence["research"]> }) {
  const empty = !research.whyContact && !research.whyPerson && !research.potentialProblem;
  return (
    <Card>
      <CardHeader
        title={
          <span className="flex items-center gap-2">
            <Crosshair className="h-4 w-4 text-indigo-500" weight="duotone" />
            Why contact this person
          </span>
        }
      />
      <div className="px-4 pb-1">
        {research.insufficientEvidence && (
          <Callout tone="warn" icon={Info} className="mt-3">
            Not enough verified evidence to make a specific case. The suggestion below is generic on purpose — nothing has been invented.
          </Callout>
        )}
        <div className="divide-y divide-neutral-100">
          {research.whyContact && <Block title="Why this company">{research.whyContact}</Block>}
          <Block title="Why now">{research.whyNow || "No recent verified triggers found."}</Block>
          {research.whyPerson && <Block title="Why this person">{research.whyPerson}</Block>}
          {research.potentialProblem && <Block title="Potential problem" tag="hypothesis, not a fact">{research.potentialProblem}</Block>}
          {research.recommendedAngle && <Block title="Recommended angle">{research.recommendedAngle}</Block>}
        </div>
        {empty && !research.recommendedAngle && <p className="pb-3 text-[13px] text-neutral-500">Nothing to add yet.</p>}
      </div>
    </Card>
  );
}
