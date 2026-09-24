import { ExternalLink, ShieldCheck } from "lucide-react";
import type { EvidenceView } from "@/lib/intelligence/read-model";
import { hostname } from "./SignalsPanel";

const TYPE: Record<string, string> = {
  website: "Company site", careers: "Careers page", news: "News", search: "Web", jobs_board: "Job board", press_release: "Press release", public_data: "Data provider",
};

export default function EvidencePanel({ evidence, sourceCount }: { evidence: EvidenceView[]; sourceCount: number }) {
  return (
    <section className="rounded-2xl border border-neutral-200 bg-white p-5">
      <h2 className="text-sm font-bold text-neutral-900 flex items-center gap-2">
        <ShieldCheck className="w-4 h-4 text-emerald-500" /> Evidence
        <span className="text-neutral-500 font-normal">{sourceCount} verified source{sourceCount === 1 ? "" : "s"}</span>
      </h2>
      {evidence.length === 0 ? (
        <p className="mt-3 text-sm text-neutral-500">No verified evidence found. Anything shown on this page is backed by a source — nothing is guessed.</p>
      ) : (
        <ul className="mt-3 space-y-4">
          {evidence.map((e) => (
            <li key={e.id} id={`evidence-${e.id}`} className="scroll-mt-24 target:ring-2 target:ring-indigo-200 rounded-lg target:bg-indigo-50/40 target:p-2">
              <p className="text-sm text-neutral-900">{e.claim}</p>
              <blockquote className="mt-1 border-l-2 border-neutral-200 pl-3 text-sm text-neutral-500 italic">“{e.snippet}”</blockquote>
              <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-neutral-500">
                <a href={e.sourceUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-indigo-600 hover:text-indigo-700">
                  {e.sourceTitle || hostname(e.sourceUrl)} <ExternalLink className="w-3 h-3" />
                </a>
                <span>{TYPE[e.sourceType] ?? e.sourceType}</span>
                <span>Captured {new Date(e.capturedAt).toLocaleDateString()}</span>
                <span title="How sure the evidence check is that this source supports the claim">{Math.round(e.confidence * 100)}% verified</span>
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
