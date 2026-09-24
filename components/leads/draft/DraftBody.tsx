import { ExternalLink } from "lucide-react";
import { segmentBody } from "@/lib/domain/personalization/segments";
import type { DraftView } from "@/lib/domain/personalization/drafts";

/**
 * The email body with every evidence-backed phrase highlighted. Hover or focus a highlight to see exactly what
 * the source said and open it — the promise of the product made visible: nothing personal without a source.
 */
export default function DraftBody({ draft }: { draft: Pick<DraftView, "body" | "claims" | "evidence"> }) {
  const segments = segmentBody(draft.body, draft.claims);
  return (
    <p className="whitespace-pre-wrap text-sm leading-relaxed text-neutral-700">
      {segments.map((seg, i) => {
        const ev = seg.evidenceId === null ? null : draft.evidence[seg.evidenceId];
        if (!ev) return <span key={i}>{seg.text}</span>;
        return (
          <span key={i} className="group relative">
            <a
              href={ev.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded bg-emerald-50 px-0.5 text-emerald-800 underline decoration-emerald-400/60 decoration-dotted underline-offset-2 hover:bg-emerald-100 focus:outline-none focus:ring-2 focus:ring-emerald-300"
              aria-label={`Backed by ${ev.sourceTitle ?? ev.sourceUrl}. ${ev.snippet}`}
            >
              {seg.text}
            </a>
            <span role="tooltip" className="pointer-events-none absolute left-0 top-full z-20 mt-1 hidden w-80 max-w-[80vw] rounded-lg border border-neutral-200 bg-white p-3 text-xs shadow-xl group-focus-within:block group-hover:block">
              <span className="block font-semibold text-emerald-700">Verified evidence</span>
              <span className="mt-1 block text-neutral-600">“{ev.snippet.length > 220 ? `${ev.snippet.slice(0, 220)}…` : ev.snippet}”</span>
              <span className="mt-2 flex items-center gap-1 text-neutral-400">
                <ExternalLink className="h-3 w-3 shrink-0" />
                <span className="truncate">{ev.sourceTitle ?? ev.sourceUrl}</span>
              </span>
            </span>
          </span>
        );
      })}
    </p>
  );
}
