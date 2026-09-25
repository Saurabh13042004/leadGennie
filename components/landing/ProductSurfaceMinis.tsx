import { ArrowUp, ArrowsClockwise, CaretDown, EnvelopeSimple, Hourglass, LinkedinLogo, Lightning, UserPlus } from "@phosphor-icons/react/ssr";
import Avatar from "@/components/ui/Avatar";
import Badge from "@/components/ui/Badge";
import { Kbd } from "@/components/ui/Field";
import { GennieMark } from "./LandingPrimitives";

/** Mini UIs for the product-surface cards. Each mirrors a real piece of the app; all decorative. */

const FILTERS = [
  { k: "Industry", v: "SaaS" },
  { k: "Region", v: "India" },
  { k: "Size", v: "50–500" },
  { k: "Hiring", v: "Sales" },
];

/** Gennie composer + the filters it produces (Leads filter row). */
export function PromptFilterMini() {
  return (
    <div aria-hidden className="space-y-3">
      <div className="rounded-xl bg-white p-3 shadow-[0_1px_2px_rgba(0,0,0,0.04)] ring-1 ring-inset ring-neutral-200">
        <div className="flex items-start gap-2.5">
          <GennieMark size="sm" className="mt-px" />
          <p className="flex-1 text-[13px] leading-relaxed text-neutral-800">
            SaaS companies in India, 50–500 employees, hiring sales leaders
            <span className="ml-0.5 inline-block h-3.5 w-px animate-pulse bg-indigo-500 align-middle" />
          </p>
        </div>
        <div className="mt-3 flex items-center justify-end gap-1.5 text-[11px] text-neutral-400">
          <Kbd>↵</Kbd> to plan
          <span className="ml-1 flex h-6 w-6 items-center justify-center rounded-md bg-neutral-900 text-white">
            <ArrowUp className="h-3 w-3" weight="bold" />
          </span>
        </div>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {FILTERS.map((f) => (
          <span key={f.k} className="flex h-7 items-center gap-1.5 rounded-lg bg-white px-2 text-[12px] ring-1 ring-inset ring-neutral-200">
            <span className="text-neutral-500">{f.k}</span>
            <span className="font-medium text-neutral-800">{f.v}</span>
            <CaretDown className="h-2.5 w-2.5 text-neutral-400" weight="bold" />
          </span>
        ))}
      </div>
    </div>
  );
}

/** Email draft card, as in Leads → Email drafts. */
export function DraftMini() {
  return (
    <div aria-hidden className="overflow-hidden rounded-xl bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)] ring-1 ring-inset ring-neutral-200">
      <div className="flex items-center gap-2.5 border-b border-neutral-100 px-3 py-2.5">
        <Avatar name="Sofia Martins" size="sm" />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13px] font-medium text-neutral-900">Sofia Martins</span>
          <span className="block truncate text-[11px] text-neutral-500">Contoso Cloud</span>
        </span>
        <Badge tone="emerald" dot>
          Personalized
        </Badge>
      </div>
      <div className="px-3 py-2.5 text-[13px] leading-relaxed text-neutral-700">
        &ldquo;Saw the recent hiring push on your revenue team. Worth sharing how other SMB GTM teams…&rdquo;
      </div>
      <div className="flex flex-wrap gap-1.5 border-t border-neutral-100 bg-neutral-50/60 px-3 py-2">
        <Badge>
          <EnvelopeSimple className="h-3 w-3" weight="duotone" />
          Email
        </Badge>
        <Badge>
          <LinkedinLogo className="h-3 w-3" weight="duotone" />
          LinkedIn
        </Badge>
        <Badge tone="indigo">
          <Lightning className="h-3 w-3" weight="duotone" />
          Intent: Hiring
        </Badge>
      </div>
    </div>
  );
}

const SEQUENCE = [
  { icon: UserPlus, title: "Connect", desc: "Wait for acceptance", channel: "LinkedIn", wait: "Wait 2 days" },
  { icon: EnvelopeSimple, title: "Send email", desc: "Personalized from context", channel: "Email", wait: "Wait 4 days" },
  { icon: ArrowsClockwise, title: "Follow up", desc: "Stop when the lead replies", channel: "Email" },
];

/** Campaign sequence timeline, as in the campaign builder. */
export function SequenceMini() {
  return (
    <ol aria-hidden className="relative">
      <span className="absolute bottom-4 left-[11px] top-4 w-px bg-neutral-200" />
      {SEQUENCE.map((s, i) => (
        <li key={s.title} className="relative">
          <div className="flex items-center gap-3">
            <span className="z-10 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-neutral-900 text-[11px] font-semibold text-white ring-4 ring-white">{i + 1}</span>
            <div className="flex min-w-0 flex-1 items-center gap-2.5 rounded-xl bg-white p-2.5 shadow-[0_1px_2px_rgba(0,0,0,0.04)] ring-1 ring-inset ring-neutral-200">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-indigo-50 text-indigo-600 ring-1 ring-inset ring-indigo-200/70">
                <s.icon className="h-4 w-4" weight="duotone" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[13px] font-medium text-neutral-900">{s.title}</span>
                <span className="block truncate text-[12px] text-neutral-500">{s.desc}</span>
              </span>
              <span className="hidden text-[11px] text-neutral-400 min-[380px]:inline">{s.channel}</span>
            </div>
          </div>
          {s.wait && (
            <div className="flex items-center gap-3 py-1.5">
              <span className="z-10 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white text-neutral-400 ring-1 ring-inset ring-neutral-200">
                <Hourglass className="h-3 w-3" weight="duotone" />
              </span>
              <span className="text-[12px] text-neutral-500">{s.wait}, then</span>
            </div>
          )}
        </li>
      ))}
    </ol>
  );
}
