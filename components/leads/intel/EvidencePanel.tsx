import { ArrowSquareOut, ShieldCheck } from "@phosphor-icons/react/ssr";
import Badge from "@/components/ui/Badge";
import Card, { CardHeader } from "@/components/ui/Card";
import type { EvidenceView } from "@/lib/intelligence/read-model";
import { hostname } from "./SignalsPanel";

const TYPE: Record<string, string> = {
  website: "Company site", careers: "Careers page", news: "News", search: "Web", jobs_board: "Job board", press_release: "Press release", public_data: "Data provider",
};

export default function EvidencePanel({ evidence, sourceCount }: { evidence: EvidenceView[]; sourceCount: number }) {
  return (
    <Card>
      <CardHeader
        title={
          <span className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-emerald-500" weight="duotone" />
            Evidence
          </span>
        }
        action={<span className="text-xs text-neutral-400 tabular-nums">{sourceCount} verified source{sourceCount === 1 ? "" : "s"}</span>}
      />
      {evidence.length === 0 ? (
        <p className="px-4 py-4 text-[13px] text-neutral-500">No verified evidence found. Anything shown on this page is backed by a source — nothing is guessed.</p>
      ) : (
        <ul className="divide-y divide-neutral-100">
          {evidence.map((e) => (
            <li key={e.id} id={`evidence-${e.id}`} className="scroll-mt-24 px-4 py-3.5 transition-colors target:bg-indigo-50/50 target:shadow-[inset_2px_0_0_#6366f1]">
              <p className="text-[13px] font-medium text-neutral-900">{e.claim}</p>
              <blockquote className="mt-2 rounded-md border-l-2 border-emerald-300 bg-neutral-50 px-3 py-2 text-[13px] italic leading-relaxed text-neutral-600">“{e.snippet}”</blockquote>
              <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-neutral-500">
                <a href={e.sourceUrl} target="_blank" rel="noopener noreferrer" className="inline-flex min-w-0 items-center gap-1 font-medium text-indigo-600 hover:text-indigo-800">
                  <span className="truncate">{e.sourceTitle || hostname(e.sourceUrl)}</span> <ArrowSquareOut className="h-3 w-3 shrink-0" weight="bold" />
                </a>
                <Badge tone="neutral">{TYPE[e.sourceType] ?? e.sourceType}</Badge>
                <span>Captured {new Date(e.capturedAt).toLocaleDateString()}</span>
                <span className="text-emerald-700" title="How sure the evidence check is that this source supports the claim">{Math.round(e.confidence * 100)}% verified</span>
              </p>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
