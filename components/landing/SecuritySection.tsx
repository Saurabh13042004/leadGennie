import { Gauge, Info, ShieldCheck } from "@phosphor-icons/react/ssr";
import { Container, Eyebrow, IconTile } from "./LandingPrimitives";

const CONTROLS = [
  { icon: ShieldCheck, title: "Mailbox-based sending", desc: "Send through the customer's connected Gmail / Outlook mailbox." },
  { icon: Gauge, title: "Verification + throttling", desc: "Use verification and sending controls before outreach is sent." },
];

const H3 = "text-[28px] font-semibold leading-[1.1] tracking-[-0.025em] text-white md:text-[34px]";
const P = "mt-4 text-[15px] leading-relaxed text-neutral-400";
const PANEL = "rounded-2xl bg-white/[0.03] p-7 ring-1 ring-inset ring-white/10 md:p-10";

export default function SecuritySection() {
  return (
    <section id="security" className="scroll-mt-16 bg-neutral-950 py-20 md:py-28">
      <Container>
        <div className="grid gap-4 lg:grid-cols-2">
          <div className={PANEL}>
            <Eyebrow dark className="mb-3">Protect your reputation</Eyebrow>
            <h2 className={H3}>More outbound shouldn&apos;t mean more damage.</h2>
            <p className={P}>
              LeadGennie is built around the customer&apos;s own connected mailbox and includes sending controls designed to
              help keep outreach paced and monitored.
            </p>
            <div className="mt-8 grid gap-3 sm:grid-cols-2">
              {CONTROLS.map((c) => (
                <div key={c.title} className="rounded-xl bg-white/[0.03] p-4 ring-1 ring-inset ring-white/10">
                  <IconTile icon={c.icon} size="sm" dark />
                  <p className="mt-3 text-[14px] font-medium text-white">{c.title}</p>
                  <p className="mt-1 text-[13px] leading-relaxed text-neutral-400">{c.desc}</p>
                </div>
              ))}
            </div>
          </div>

          <div className={`${PANEL} flex flex-col`}>
            <Eyebrow dark className="mb-3">LinkedIn safety</Eyebrow>
            <h2 className={H3}>Work with signals, not spam.</h2>
            <p className={P}>
              LeadGennie can incorporate LinkedIn activity into the workflow, from connection actions and follow-ups to
              likes, comments and intent signals.
            </p>
            <div className="mt-8 flex items-start gap-3 rounded-xl bg-white/[0.03] p-4 ring-1 ring-inset ring-white/10 lg:mt-auto">
              <IconTile icon={Info} size="sm" dark />
              <div>
                <p className="text-[14px] font-medium text-white">Upcoming channels stay upcoming.</p>
                <p className="mt-0.5 text-[13px] leading-relaxed text-neutral-400">
                  Phone, SMS and WhatsApp are not presented here as live product capabilities.
                </p>
              </div>
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}
