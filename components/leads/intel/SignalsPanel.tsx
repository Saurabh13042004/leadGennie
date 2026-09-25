import { ArrowSquareOut, Lightning, Quotes } from "@phosphor-icons/react/ssr";
import Badge from "@/components/ui/Badge";
import Card, { CardHeader } from "@/components/ui/Card";
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
    <Card>
      <CardHeader
        title={
          <span className="flex items-center gap-2">
            <Lightning className="h-4 w-4 text-amber-500" weight="duotone" />
            Buying signals <span className="font-normal text-neutral-400">— why now</span>
          </span>
        }
        action={signals.length > 0 ? <span className="text-xs tabular-nums text-neutral-400">{signals.length} verified</span> : undefined}
      />
      {signals.length === 0 ? (
        <p className="px-4 py-4 text-[13px] text-neutral-500">No recent, verified buying signals found for this company.</p>
      ) : (
        <ul className="divide-y divide-neutral-100">
          {signals.map((s) => (
            <li key={s.id} className="px-4 py-3">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <Badge tone="amber">{LABEL[s.type] ?? s.type}</Badge>
                <span className="min-w-0 text-[13px] font-medium text-neutral-900">{s.title}</span>
                <span className="ml-auto text-xs text-neutral-400 tabular-nums" title="Confidence that this is true, from the evidence check">
                  {Math.round(s.confidence * 100)}% confidence
                </span>
              </div>
              {s.description && <p className="mt-1 text-[13px] text-neutral-500">{s.description}</p>}
              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-neutral-500">
                {s.detectedAt && <span>Source dated {s.detectedAt}</span>}
                {s.evidence.map((e) => (
                  <span key={e.id} className="inline-flex items-center gap-2">
                    <a href={e.sourceUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-medium text-indigo-600 hover:text-indigo-800">
                      {hostname(e.sourceUrl)} <ArrowSquareOut className="h-3 w-3" weight="bold" />
                    </a>
                    <a href={`#evidence-${e.id}`} className="inline-flex items-center gap-0.5 text-neutral-400 hover:text-neutral-700">
                      <Quotes className="h-3 w-3" weight="fill" />
                      quote
                    </a>
                  </span>
                ))}
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
