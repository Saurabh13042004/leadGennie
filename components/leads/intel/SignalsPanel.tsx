import { ExternalLink, Flame } from "lucide-react";
import type { SignalView } from "@/lib/intelligence/read-model";

const LABEL: Record<string, string> = {
  FUNDING: "Funding", HIRING: "Hiring", EXPANSION: "Expansion", PRODUCT_LAUNCH: "Product launch",
  LEADERSHIP_CHANGE: "Leadership change", TECH_CHANGE: "Tech change", JOB_POSTING: "Job postings", NEWS: "News",
};

export function hostname(url: string): string {
  try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return url; }
}

/** Only VERIFIED signals appear here. Each one links to the evidence that backs it. */
export default function SignalsPanel({ signals }: { signals: SignalView[] }) {
  return (
    <section className="rounded-xl border border-white/10 bg-[#0A0A0A] p-5">
      <h2 className="text-sm font-semibold text-white flex items-center gap-2"><Flame className="w-4 h-4 text-orange-400" /> Buying signals <span className="text-neutral-600 font-normal">— why now</span></h2>
      {signals.length === 0 ? (
        <p className="mt-3 text-sm text-neutral-500">No recent, verified buying signals found for this company.</p>
      ) : (
        <ul className="mt-3 divide-y divide-white/5">
          {signals.map((s) => (
            <li key={s.id} className="py-3 first:pt-0 last:pb-0">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className="text-[10px] uppercase tracking-wide rounded border border-orange-500/25 bg-orange-500/10 text-orange-200 px-1.5 py-0.5">{LABEL[s.type] ?? s.type}</span>
                <span className="text-sm text-white">{s.title}</span>
                <span className="ml-auto text-xs text-neutral-500 tabular-nums" title="Confidence that this is true, from the evidence check">{Math.round(s.confidence * 100)}% confidence</span>
              </div>
              {s.description && <p className="mt-1 text-sm text-neutral-400">{s.description}</p>}
              <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-neutral-500">
                {s.detectedAt && <span>Source dated {s.detectedAt}</span>}
                {s.evidence.map((e) => (
                  <span key={e.id} className="inline-flex items-center gap-1">
                    <a href={e.sourceUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-blue-400 hover:underline">
                      {hostname(e.sourceUrl)} <ExternalLink className="w-3 h-3" />
                    </a>
                    <a href={`#evidence-${e.id}`} className="text-neutral-600 hover:text-neutral-300">quote</a>
                  </span>
                ))}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
