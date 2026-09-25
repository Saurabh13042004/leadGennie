import { Check, Minus, Sparkle, X } from "@phosphor-icons/react/ssr";
import { CompanyMark } from "@/components/ui/Avatar";
import { cn } from "@/lib/utils";
import { ourMark, theirMark, type CellMark, type CompareTableRow } from "./compare-core";

const MARK: Record<CellMark, { cls: string; label: string }> = {
  yes: { cls: "bg-emerald-50 text-emerald-600 ring-emerald-200/70", label: "Supported" },
  no: { cls: "bg-rose-50 text-rose-600 ring-rose-200/70", label: "Not supported" },
  partial: { cls: "bg-neutral-100 text-neutral-500 ring-neutral-200/80", label: "Partial" },
  neutral: { cls: "bg-neutral-50 text-neutral-300 ring-neutral-200/60", label: "" },
};

function Mark({ mark }: { mark: CellMark }) {
  const m = MARK[mark];
  return (
    <span className={cn("mt-px flex h-5 w-5 shrink-0 items-center justify-center rounded-full ring-1 ring-inset", m.cls)} aria-label={m.label || undefined} role={m.label ? "img" : undefined}>
      {mark === "yes" && <Check className="h-3 w-3" weight="bold" />}
      {mark === "no" && <X className="h-3 w-3" weight="bold" />}
      {mark === "partial" && <Minus className="h-3 w-3" weight="bold" />}
      {mark === "neutral" && <span className="h-1 w-1 rounded-full bg-current" />}
    </span>
  );
}

function Cell({ mark, text, strong }: { mark: CellMark; text: string; strong?: boolean }) {
  return (
    <div className="flex items-start gap-2.5">
      <Mark mark={mark} />
      <span className={cn("text-[14px] leading-snug", strong ? "font-medium text-neutral-900" : "text-neutral-600")}>{text}</span>
    </div>
  );
}

function OurLabel() {
  return (
    <span className="inline-flex items-center gap-2">
      <span className="flex h-6 w-6 items-center justify-center rounded-md bg-neutral-900 text-white">
        <Sparkle className="h-3.5 w-3.5" weight="fill" />
      </span>
      LeadGennie
    </span>
  );
}

/** Feature-by-feature table (desktop) that collapses into stacked rows on small screens. */
export default function CompareTable({ competitor, rows }: { competitor: string; rows: CompareTableRow[] }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-neutral-200/80 bg-white shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
      {/* Desktop / tablet */}
      <table className="hidden w-full table-fixed border-collapse text-left sm:table">
        <colgroup>
          <col className="w-[26%]" />
          <col className="w-[37%]" />
          <col className="w-[37%]" />
        </colgroup>
        <thead>
          <tr className="border-b border-neutral-200/80">
            <th scope="col" className="bg-neutral-50/70 px-5 py-4 text-[11px] font-medium uppercase tracking-wider text-neutral-500">
              Feature
            </th>
            <th scope="col" className="bg-neutral-50/70 px-5 py-4 text-[13px] font-semibold text-neutral-700">
              <span className="inline-flex items-center gap-2">
                <CompanyMark name={competitor} size="sm" />
                {competitor}
              </span>
            </th>
            <th scope="col" className="bg-indigo-50/60 px-5 py-4 text-[13px] font-semibold text-neutral-900">
              <OurLabel />
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-100">
          {rows.map((row) => (
            <tr key={row.feature} className="align-top">
              <th scope="row" className="px-5 py-4 text-[14px] font-medium text-neutral-900">
                {row.feature}
              </th>
              <td className="px-5 py-4">
                <Cell mark={theirMark(row.their)} text={row.their} />
              </td>
              <td className="bg-indigo-50/25 px-5 py-4">
                <Cell mark={ourMark(row)} text={row.ours} strong={row.oursHighlight} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Phone */}
      <ul className="divide-y divide-neutral-100 sm:hidden">
        {rows.map((row) => (
          <li key={row.feature} className="px-4 py-4">
            <p className="text-[11px] font-medium uppercase tracking-wider text-neutral-500">{row.feature}</p>
            <div className="mt-3 space-y-2.5">
              <div>
                <p className="mb-1 flex items-center gap-1.5 text-xs font-medium text-neutral-500">
                  <CompanyMark name={competitor} size="xs" />
                  {competitor}
                </p>
                <Cell mark={theirMark(row.their)} text={row.their} />
              </div>
              <div className="rounded-lg bg-indigo-50/50 p-2.5 ring-1 ring-inset ring-indigo-100">
                <p className="mb-1 flex items-center gap-1.5 text-xs font-medium text-neutral-700">
                  <span className="flex h-5 w-5 items-center justify-center rounded-md bg-neutral-900 text-white">
                    <Sparkle className="h-3 w-3" weight="fill" />
                  </span>
                  LeadGennie
                </p>
                <Cell mark={ourMark(row)} text={row.ours} strong={row.oursHighlight} />
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
