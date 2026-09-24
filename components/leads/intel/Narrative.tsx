import type { LeadIntelligence } from "@/lib/intelligence/read-model";

function Block({ title, children, tag }: { title: string; children: React.ReactNode; tag?: string }) {
  return (
    <div>
      <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-400 flex items-center gap-2">
        {title}
        {tag && <span className="normal-case tracking-normal rounded bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-200 px-1.5 py-0.5 text-[10px] font-medium">{tag}</span>}
      </h3>
      <p className="mt-1 text-sm text-neutral-700 leading-relaxed">{children}</p>
    </div>
  );
}

/** The outreach strategy. Every factual sentence here was re-verified by the engine; hypotheses are labelled. */
export default function Narrative({ research }: { research: NonNullable<LeadIntelligence["research"]> }) {
  const empty = !research.whyContact && !research.whyPerson && !research.potentialProblem;
  return (
    <section className="rounded-2xl border border-neutral-200 bg-white p-5 space-y-4">
      <h2 className="text-sm font-bold text-neutral-900">Why contact this person</h2>
      {research.insufficientEvidence && (
        <p className="text-sm rounded-lg border border-amber-200 bg-amber-50 text-amber-800 px-3 py-2">
          Not enough verified evidence to make a specific case. The suggestion below is generic on purpose — nothing has been invented.
        </p>
      )}
      {research.whyContact && <Block title="Why this company">{research.whyContact}</Block>}
      <Block title="Why now">{research.whyNow || "No recent verified triggers found."}</Block>
      {research.whyPerson && <Block title="Why this person">{research.whyPerson}</Block>}
      {research.potentialProblem && <Block title="Potential problem" tag="hypothesis, not a fact">{research.potentialProblem}</Block>}
      {research.recommendedAngle && <Block title="Recommended angle">{research.recommendedAngle}</Block>}
      {empty && !research.recommendedAngle && <p className="text-sm text-neutral-500">Nothing to add yet.</p>}
    </section>
  );
}
