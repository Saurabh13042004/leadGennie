import { CheckCircle, MinusCircle, Question, XCircle } from "@phosphor-icons/react/ssr";
import Card, { CardHeader } from "@/components/ui/Card";
import type { CriterionView } from "@/lib/intelligence/read-model";

const ICON = {
  met: { Icon: CheckCircle, cls: "text-emerald-500", label: "Matches" },
  partial: { Icon: MinusCircle, cls: "text-amber-500", label: "Partly matches" },
  not_met: { Icon: XCircle, cls: "text-rose-500", label: "Does not match" },
  unknown: { Icon: Question, cls: "text-neutral-300", label: "Unknown" },
} as const;

/** "Why this lead?" — templated by the engine from the score breakdown, so it can't disagree with the number. */
export default function WhyFit({ items }: { items: CriterionView[] }) {
  if (items.length === 0) return null;
  return (
    <Card className="min-w-0">
      <CardHeader title="Why this lead?" description="Each line comes from the score breakdown" />
      <ul className="divide-y divide-neutral-100 px-4">
        {items.map((w) => {
          const { Icon, cls, label } = ICON[w.status];
          return (
            <li key={w.criterion} className="flex items-start gap-2.5 py-2 text-[13px]">
              <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${cls}`} weight="fill" aria-label={label} />
              <span className="min-w-0 flex-1 text-neutral-700">{w.text}</span>
              {w.evidenceIds.length > 0 && (
                <a
                  href={`#evidence-${w.evidenceIds[0]}`}
                  className="shrink-0 rounded-md px-1.5 py-0.5 text-[11px] font-medium text-indigo-600 ring-1 ring-inset ring-indigo-200/70 transition-colors hover:bg-indigo-50"
                >
                  source
                </a>
              )}
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
