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

        <h2 id="book-demo-title" className="mt-6 text-[22px] font-semibold leading-tight tracking-[-0.02em] text-neutral-950 md:text-2xl">
          See LeadGennie in action.
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-neutral-600">
          Learn how modern GTM teams automate outbound, improve deliverability, and book more meetings.
        </p>

        <p className="mt-7 text-[11px] font-medium uppercase tracking-wider text-neutral-500">What you get</p>
        <ul className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2 md:grid-cols-1">
          {BENEFITS.map(({ label, icon: BenefitIcon, ai }) => (
            <li key={label} className="flex items-center gap-3">
              <span
                className={cn(
                  "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ring-1 ring-inset",
                  ai ? "bg-violet-50 text-violet-600 ring-violet-200/70" : "bg-white text-neutral-700 ring-neutral-200/80 shadow-[0_1px_2px_rgba(0,0,0,0.03)]",
                )}
              >
                <BenefitIcon className="h-3.5 w-3.5" weight="duotone" />
              </span>
              <span className="text-[13px] font-medium text-neutral-800">{label}</span>
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
