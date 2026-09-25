import { ArrowUp, CheckCircle, ListNumbers, UsersThree } from "@phosphor-icons/react/ssr";
import Badge from "@/components/ui/Badge";
import { Kbd } from "@/components/ui/Field";
import { cn } from "@/lib/utils";
import { GennieMark } from "./LandingPrimitives";

const STEPS = [
  { icon: UsersThree, title: "Find leads", result: "Selected 18 researched leads" },
  { icon: ListNumbers, title: "Rank by ICP score", result: "Top 5 ready to review" },
];

/** Floating "Ask Gennie" card — mirrors the Gennie run view (plan steps + composer). Decorative. */
export default function MockupGennieCard({ className }: { className?: string }) {
  return (
    <div className={cn("w-[330px] overflow-hidden rounded-xl bg-white text-[13px] shadow-[0_24px_60px_-16px_rgba(76,29,149,0.35),0_0_0_1px_rgba(0,0,0,0.06)]", className)}>
      <div className="flex items-center gap-2 border-b border-neutral-100 px-3.5 py-2.5">
        <GennieMark />
        <span className="font-semibold text-neutral-900">Gennie</span>
        <Badge tone="emerald" dot>
          Completed
        </Badge>
      </div>

      <div className="space-y-3 px-3.5 py-3">
        <p className="ml-auto w-fit max-w-[250px] rounded-xl bg-neutral-100 px-3 py-1.5 text-neutral-800">Which leads should I contact first?</p>
        <div className="rounded-lg ring-1 ring-inset ring-neutral-200/80">
          {STEPS.map(({ icon: Icon, title, result }, i) => (
            <div key={title} className={cn("flex items-start gap-2.5 px-3 py-2.5", i > 0 && "border-t border-neutral-100")}>
              <CheckCircle className="mt-px h-4 w-4 shrink-0 text-emerald-500" weight="fill" />
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1.5 font-medium text-neutral-900">
                  <Icon className="h-3.5 w-3.5 text-neutral-400" weight="duotone" />
                  {title}
                </span>
                <span className="mt-0.5 block text-[12px] text-neutral-500">{result}</span>
              </span>
              <span className="text-[11px] text-neutral-400">Done</span>
            </div>
          ))}
        </div>
      </div>

      <div className="border-t border-neutral-100 bg-neutral-50/60 p-2.5">
        <div className="flex h-9 items-center gap-2 rounded-lg bg-white pl-3 pr-1 ring-1 ring-inset ring-neutral-200">
          <span className="flex-1 truncate text-neutral-400">Ask Gennie something else…</span>
          <Kbd>↵</Kbd>
          <span className="flex h-7 w-7 items-center justify-center rounded-md bg-neutral-900 text-white">
            <ArrowUp className="h-3.5 w-3.5" weight="bold" />
          </span>
        </div>
      </div>
    </div>
  );
}
