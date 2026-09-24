import type { LeadIntelligence } from "@/lib/intelligence/read-model";

function Block({ title, children, tag }: { title: string; children: React.ReactNode; tag?: string }) {
  return (
    <div>
      <h3 className="text-xs uppercase tracking-wider text-neutral-500 flex items-center gap-2">
        {title}
        {tag && <span className="normal-case tracking-normal rounded border border-white/10 px-1.5 py-0.5 text-[10px] text-neutral-400">{tag}</span>}
      </h3>
      <p className="mt-1 text-sm text-neutral-200 leading-relaxed">{children}</p>
    </div>
  );
}

/** The outreach strategy. Every factual sentence here was re-verified by the engine; hypotheses are labelled. */
export default function Narrative({ research }: { research: NonNullable<LeadIntelligence["research"]> }) {
  const empty = !research.whyContact && !research.whyPerson && !research.potentialProblem;
  return (
    <section className="rounded-xl border border-white/10 bg-[#0A0A0A] p-5 space-y-4">
      <h2 className="text-sm font-semibold text-white">Why contact this person</h2>
      {research.insufficientEvidence && (
        <p className="text-sm rounded-lg border border-yellow-500/20 bg-yellow-500/5 text-yellow-100/90 px-3 py-2">
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
