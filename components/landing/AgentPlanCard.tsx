import { Buildings, Lightning, ListChecks, MagnifyingGlass, PaperPlaneTilt, PencilSimple, Play } from "@phosphor-icons/react/ssr";
import Badge from "@/components/ui/Badge";
import { buttonClasses } from "@/components/ui/Button";
import { GennieMark } from "./LandingPrimitives";

const PLAN = [
  { icon: MagnifyingGlass, kind: "Input", title: "Find SaaS buyers" },
  { icon: Buildings, kind: "Enrich", title: "Company + POC data" },
  { icon: Lightning, kind: "Intent", title: "Hiring / funding / activity" },
  { icon: PaperPlaneTilt, kind: "Outreach", title: "Email + LinkedIn sequence" },
];

/** Gennie plan card awaiting approval — mirrors the Ask Gennie plan → approve → run view. Decorative. */
export default function AgentPlanCard() {
  return (
    <div aria-hidden className="mx-auto w-full max-w-[460px] text-[13px]">
      <p className="mb-4 ml-auto w-fit max-w-[340px] rounded-2xl bg-white px-3.5 py-2 text-neutral-800 shadow-[0_1px_2px_rgba(0,0,0,0.04)] ring-1 ring-inset ring-neutral-200">
        Find SaaS buyers who are hiring and start an email + LinkedIn sequence.
      </p>

      <div className="flex items-center gap-2">
        <GennieMark />
        <span className="font-semibold text-neutral-900">Gennie</span>
        <Badge tone="amber" dot>
          Awaiting approval
        </Badge>
      </div>

      <div className="mt-3 overflow-hidden rounded-xl bg-white shadow-[0_24px_60px_-24px_rgba(76,29,149,0.35),0_0_0_1px_rgba(0,0,0,0.06)]">
        <div className="flex items-center gap-2 border-b border-neutral-100 px-4 py-3">
          <ListChecks className="h-4 w-4 text-violet-600" weight="duotone" />
          <span className="font-semibold text-neutral-900">Plan</span>
          <span className="rounded-md bg-neutral-100 px-1.5 py-0.5 text-[11px] text-neutral-500">4 steps</span>
        </div>
        <ol className="relative px-4 py-3">
          <span className="absolute bottom-7 left-[27px] top-7 w-px bg-neutral-200" />
          {PLAN.map((s, i) => (
            <li key={s.kind} className="relative flex items-center gap-3 py-2">
              <span className="z-10 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white text-[11px] font-semibold text-neutral-500 ring-1 ring-inset ring-neutral-300">
                {i + 1}
              </span>
              <s.icon className="h-4 w-4 shrink-0 text-neutral-400" weight="duotone" />
              <span className="min-w-0 flex-1 truncate font-medium text-neutral-900">{s.title}</span>
              <span className="text-[10px] font-medium uppercase tracking-wider text-neutral-400">{s.kind}</span>
            </li>
          ))}
        </ol>
        <div className="flex flex-col gap-3 border-t border-neutral-100 bg-neutral-50/60 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[12px] leading-relaxed text-neutral-500">
            <span className="font-medium text-neutral-800">Review before execution</span>{" "}· workflow steps can be adjusted based on your team&apos;s process.
          </p>
          <div className="flex shrink-0 gap-2">
            <span className={buttonClasses({ variant: "secondary", size: "xs" })}>
              <PencilSimple className="h-3.5 w-3.5" weight="bold" />
              Edit
            </span>
            <span className={buttonClasses({ variant: "primary", size: "xs" })}>
              <Play className="h-3 w-3" weight="fill" />
              Approve
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
