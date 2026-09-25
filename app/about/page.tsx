import { ArrowsClockwise, Buildings, EnvelopeSimple, Lightning, ShieldCheck, Target } from "@phosphor-icons/react/ssr";
import { buttonClasses } from "@/components/ui/Button";
import PageShell from "@/components/landing/pages-kit/PageShell";
import SectionHeading, { Eyebrow, HeroBackdrop } from "@/components/landing/pages-kit/SectionHeading";
import type { NavIcon } from "@/lib/nav-config";

const BELIEFS: { title: string; desc: string; icon: NavIcon }[] = [
  {
    title: "Deep personalization",
    desc: "Generic email templates don't work anymore. Outbound has to be grounded in prospect intent, company context and ICP-driven parameters.",
    icon: Target,
  },
  {
    title: "Automated scale",
    desc: "A single operator should be able to run outbound with the leverage of a much larger SDR team, through well-built AI workflows.",
    icon: Lightning,
  },
  {
    title: "Data-driven workflows",
    desc: "Outbound activity should feed back into HubSpot and other CRM tools, keeping lead data current without manual syncing.",
    icon: ArrowsClockwise,
  },
  {
    title: "Deliverability first",
    desc: "Scale is worthless if messages land in spam. Mailbox-based sending and sending controls are core to how LeadGennie is built.",
    icon: ShieldCheck,
  },
];

const DICE_FOCUS = ["AI", "SaaS infrastructure", "Automation", "Developer tooling"];

export default function AboutPage() {
  return (
    <PageShell>
      {/* Hero + story */}
      <section className="relative isolate px-4 pb-20 pt-16 md:px-6 md:pb-28 md:pt-24">
        <HeroBackdrop />
        <div className="mx-auto max-w-6xl">
          <Eyebrow>Our story</Eyebrow>
          <h1 className="mt-3 text-[40px] font-semibold leading-[1.04] tracking-[-0.035em] text-neutral-950 sm:text-5xl md:text-[60px]">About LeadGennie</h1>
          <p className="mt-4 text-[17px] text-neutral-500">Building the AI-led outbound stack for SMB teams</p>

          <div className="mt-14 grid grid-cols-1 gap-8 border-t border-neutral-200/80 pt-10 md:mt-16 md:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] md:gap-16 md:pt-12">
            <p className="text-[22px] font-medium leading-[1.4] tracking-[-0.015em] text-neutral-900 md:text-[26px]">
              LeadGennie is building an AI-led outbound stack for SMB revenue teams.{" "}
              <span className="text-neutral-500">
                We believe outbound should feel intelligent, personalized and fast — not like manual spreadsheet busywork.
              </span>
            </p>
            <p className="text-[16px] leading-[1.75] text-neutral-600 md:pt-1.5">
              Our goal is to replace repetitive workflows with reviewable automation that helps teams generate pipeline with less manual effort. By handling data
              enrichment, signal detection and message drafting inside one workflow, sales teams can spend their time on what actually needs a human: building
              trust and closing deals.
            </p>
          </div>
        </div>
      </section>

      {/* Beliefs */}
      <section className="border-y border-neutral-200/80 bg-[#fafaf9] px-4 py-20 md:px-6 md:py-28">
        <div className="mx-auto max-w-6xl">
          <SectionHeading eyebrow="Principles" title="What we believe" />
          <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 md:gap-5">
            {BELIEFS.map(({ title, desc, icon: Icon }, i) => (
              <div key={title} className="rounded-2xl border border-neutral-200/80 bg-white p-6 shadow-[0_1px_2px_rgba(0,0,0,0.03)] md:p-7">
                <div className="flex items-center justify-between">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-neutral-100 text-neutral-700 ring-1 ring-inset ring-neutral-200/70">
                    <Icon className="h-4.5 w-4.5" weight="duotone" />
                  </span>
                  <span className="text-xs font-medium tabular-nums text-neutral-400">{String(i + 1).padStart(2, "0")}</span>
                </div>
                <h3 className="mt-5 text-[17px] font-semibold tracking-tight text-neutral-950">{title}</h3>
                <p className="mt-2 text-[15px] leading-relaxed text-neutral-600">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* DICE Solutions */}
      <section className="px-4 py-20 md:px-6 md:py-28">
        <div className="mx-auto grid max-w-6xl grid-cols-1 items-start gap-10 md:grid-cols-2 md:gap-16">
          <div>
            <SectionHeading eyebrow="The company" title="Built by DICE Solutions" />
            <p className="mt-5 text-[16px] leading-[1.75] text-neutral-600">
              LeadGennie is a product developed and operated by <strong className="font-semibold text-neutral-900">DICE Solutions</strong>.
            </p>
            <p className="mt-4 text-[16px] leading-[1.75] text-neutral-600">
              DICE Solutions builds scalable software products at the intersection of AI, SaaS infrastructure, automation and developer tooling. That engineering
              foundation is what LeadGennie is built on.
            </p>
          </div>
          <div className="rounded-2xl border border-neutral-200/80 bg-white p-2 shadow-[0_1px_2px_rgba(0,0,0,0.03),0_16px_40px_-24px_rgba(0,0,0,0.2)]">
            <div className="flex items-center gap-3 rounded-xl bg-neutral-50 px-4 py-4 ring-1 ring-inset ring-neutral-200/70">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-neutral-900 text-white">
                <Buildings className="h-5 w-5" weight="duotone" />
              </span>
              <div>
                <p className="text-[15px] font-semibold text-neutral-950">DICE Solutions</p>
                <p className="text-[13px] text-neutral-500">Developer and operator of LeadGennie</p>
              </div>
            </div>
            <div className="px-4 pb-3 pt-5">
              <Eyebrow>Builds at the intersection of</Eyebrow>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {DICE_FOCUS.map((f) => (
                  <span key={f} className="inline-flex h-7 items-center rounded-lg bg-white px-2.5 text-[13px] font-medium text-neutral-700 ring-1 ring-inset ring-neutral-200">
                    {f}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Contact */}
      <section className="px-4 pb-20 md:px-6 md:pb-28">
        <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-6 rounded-2xl border border-neutral-200/80 bg-[#fafaf9] p-6 sm:flex-row sm:items-center md:p-8">
          <div className="flex items-start gap-4">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-neutral-700 ring-1 ring-inset ring-neutral-200/80">
              <EnvelopeSimple className="h-5 w-5" weight="duotone" />
            </span>
            <div>
              <h2 className="text-[20px] font-semibold tracking-tight text-neutral-950">Get in touch</h2>
              <p className="mt-1 max-w-xl text-[15px] leading-relaxed text-neutral-600">
                Whether you want to learn more, explore a custom setup, or just have questions, reach us at{" "}
                <a href="mailto:support@leadgennie.ai" className="font-medium text-indigo-600 hover:underline">
                  support@leadgennie.ai
                </a>
                .
              </p>
            </div>
          </div>
          <a href="mailto:support@leadgennie.ai" className={buttonClasses({ variant: "primary", className: "h-10 gap-2 px-4 text-sm" })}>
            <EnvelopeSimple className="h-4 w-4" weight="bold" />
            Email us
          </a>
        </div>
      </section>
    </PageShell>
  );
}
