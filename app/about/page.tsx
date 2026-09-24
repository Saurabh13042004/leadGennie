import LandingNavbar from "@/components/landing/LandingNavbar";
import LandingFooter from "@/components/landing/LandingFooter";

const BELIEFS = [
  {
    title: "Deep personalization",
    desc: "Generic email templates don't work anymore. Outbound has to be grounded in prospect intent, company context and ICP-driven parameters.",
  },
  {
    title: "Automated scale",
    desc: "A single operator should be able to run outbound with the leverage of a much larger SDR team, through well-built AI workflows.",
  },
  {
    title: "Data-driven workflows",
    desc: "Outbound activity should feed back into HubSpot and other CRM tools, keeping lead data current without manual syncing.",
  },
  {
    title: "Deliverability first",
    desc: "Scale is worthless if messages land in spam. Mailbox-based sending and sending controls are core to how LeadGennie is built.",
  },
];

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-white text-neutral-900">
      <LandingNavbar />

      <main className="px-5 pb-24 pt-16 md:pt-20">
        <div className="mx-auto max-w-3xl">
          <div className="mb-10 border-b border-neutral-200 pb-8">
            <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.14em] text-indigo-500">Our story</p>
            <h1 className="mb-4 text-4xl font-extrabold tracking-[-0.03em] text-neutral-900">About LeadGennie</h1>
            <p className="text-sm text-neutral-500">Building the AI-led outbound stack for SMB teams</p>
          </div>

          <div className="flex flex-col gap-8 leading-relaxed text-neutral-600">
            <p className="text-lg text-neutral-700">
              LeadGennie is building an AI-led outbound stack for SMB revenue teams. We believe outbound should feel
              intelligent, personalized and fast — not like manual spreadsheet busywork.
            </p>
            <p>
              Our goal is to replace repetitive workflows with reviewable automation that helps teams generate
              pipeline with less manual effort. By handling data enrichment, signal detection and message drafting
              inside one workflow, sales teams can spend their time on what actually needs a human: building trust
              and closing deals.
            </p>

            <hr className="border-neutral-200" />

            <section className="flex flex-col gap-3">
              <h2 className="text-xl font-bold tracking-tight text-neutral-900">Built by DICE Solutions</h2>
              <p>
                LeadGennie is a product developed and operated by <strong className="text-neutral-900">DICE Solutions</strong>.
              </p>
              <p className="text-neutral-500">
                DICE Solutions builds scalable software products at the intersection of AI, SaaS infrastructure,
                automation and developer tooling. That engineering foundation is what LeadGennie is built on.
              </p>
            </section>

            <section className="flex flex-col gap-4">
              <h2 className="text-xl font-bold tracking-tight text-neutral-900">What we believe</h2>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {BELIEFS.map((b) => (
                  <div key={b.title} className="rounded-2xl border border-neutral-200 bg-neutral-50 p-5">
                    <h3 className="mb-2 text-sm font-bold text-neutral-900">{b.title}</h3>
                    <p className="text-[13px] leading-relaxed text-neutral-500">{b.desc}</p>
                  </div>
                ))}
              </div>
            </section>

            <section className="flex flex-col gap-3 border-t border-neutral-200 pt-6">
              <h2 className="text-xl font-bold tracking-tight text-neutral-900">Get in touch</h2>
              <p>
                Whether you want to learn more, explore a custom setup, or just have questions, reach us at{" "}
                <a href="mailto:support@leadgennie.ai" className="font-medium text-indigo-600 hover:underline">
                  support@leadgennie.ai
                </a>
                .
              </p>
            </section>
          </div>
        </div>
      </main>

      <LandingFooter />
    </div>
  );
}
