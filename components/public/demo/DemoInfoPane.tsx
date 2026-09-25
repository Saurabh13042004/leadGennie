import { Handshake, Lightning, PaperPlaneTilt, ShieldCheck, Sparkle } from "@phosphor-icons/react/ssr";
import type { NavIcon } from "@/lib/nav-config";
import GennieMark from "@/components/gennie/GennieMark";
import { cn } from "@/lib/utils";

const BENEFITS: { label: string; icon: NavIcon; ai?: boolean }[] = [
  { label: "Personalized onboarding", icon: Handshake },
  { label: "Deliverability guidance", icon: ShieldCheck },
  { label: "Campaign setup walkthrough", icon: PaperPlaneTilt },
  { label: "Early access features", icon: Lightning },
  { label: "AI outbound tips", icon: Sparkle, ai: true },
];

/** Left pane of the demo request dialog: the Sparkle mark, pitch and what-you-get checklist. */
export default function DemoInfoPane({ bestForStartups }: { bestForStartups: boolean }) {
  return (
    <div className="relative flex flex-col justify-between gap-6 overflow-hidden border-b border-neutral-200/80 bg-[#f7f7f6] p-6 md:border-b-0 md:border-r md:p-8">
      <div aria-hidden className="pointer-events-none absolute -left-24 -top-24 h-64 w-64 rounded-full bg-gradient-to-br from-violet-300/25 via-fuchsia-300/10 to-transparent blur-3xl" />
      <div className="relative">
        <div className="flex items-center gap-3">
          <GennieMark size="md" />
          <span className="inline-flex h-6 items-center gap-1.5 rounded-md bg-white px-2 text-[11px] font-medium text-neutral-600 ring-1 ring-inset ring-neutral-200/80">
            <span className="h-1.5 w-1.5 rounded-full bg-indigo-500" />
            Early Access • Limited Onboarding
          </span>
        </div>

        <h2 id="book-demo-title" className="mt-5 md:mt-6 text-[22px] font-semibold leading-tight tracking-[-0.02em] text-neutral-950 md:text-2xl">
          See LeadGennie in action.
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-neutral-600">
          Learn how modern GTM teams automate outbound, improve deliverability, and book more meetings.
        </p>

        <p className="mt-5 text-[11px] md:mt-7 font-medium uppercase tracking-wider text-neutral-500">What you get</p>
        <ul className="mt-3 flex flex-wrap gap-1.5 md:flex-col md:gap-2">
          {BENEFITS.map(({ label, icon: BenefitIcon, ai }) => (
            <li
              key={label}
              className="flex items-center gap-1.5 rounded-lg bg-white py-1 pl-1 pr-2.5 ring-1 ring-inset ring-neutral-200/80 md:gap-3 md:bg-transparent md:p-0 md:ring-0"
            >
              <span
                className={cn(
                  "flex h-5 w-5 shrink-0 items-center justify-center rounded-md md:h-7 md:w-7 md:rounded-lg md:ring-1 md:ring-inset",
                  ai ? "bg-violet-50 text-violet-600 md:ring-violet-200/70" : "text-neutral-600 md:bg-white md:text-neutral-700 md:shadow-[0_1px_2px_rgba(0,0,0,0.03)] md:ring-neutral-200/80",
                )}
              >
                <BenefitIcon className="h-3.5 w-3.5" weight="duotone" />
              </span>
              <span className="text-xs font-medium text-neutral-700 md:text-[13px] md:text-neutral-800">{label}</span>
            </li>
          ))}
        </ul>
      </div>

      <p className="relative hidden text-xs text-neutral-500 md:block">
        Built for modern GTM teams {bestForStartups && "• Best for startups"}
      </p>
    </div>
  );
}
