import { Check } from "lucide-react";

export default function SecuritySection() {
  return (
    <section id="security" className="py-6">
      <div className="mx-auto max-w-6xl px-5">
        <div className="overflow-hidden rounded-3xl bg-neutral-900">
          <div className="grid grid-cols-1 lg:grid-cols-2">
            <div className="p-8 sm:p-12">
              <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.14em] text-neutral-500">
                Protect your reputation
              </p>
              <h3 className="mb-4 text-3xl font-extrabold leading-tight tracking-[-0.02em] text-white sm:text-4xl">
                More outbound shouldn&apos;t mean more damage.
              </h3>
              <p className="mb-6 text-sm leading-relaxed text-neutral-400">
                LeadGennie is built around the customer&apos;s own connected mailbox and includes sending controls
                designed to help keep outreach paced and monitored.
              </p>
              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3.5">
                  <div className="mb-1.5 flex items-center gap-1.5 text-[12px] font-bold text-white">
                    <Check className="h-3.5 w-3.5 text-emerald-400" />
                    Mailbox-based sending
                  </div>
                  <p className="text-[11px] leading-relaxed text-neutral-500">
                    Send through the customer&apos;s connected Gmail / Outlook mailbox.
                  </p>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3.5">
                  <div className="mb-1.5 flex items-center gap-1.5 text-[12px] font-bold text-white">
                    <Check className="h-3.5 w-3.5 text-emerald-400" />
                    Verification + throttling
                  </div>
                  <p className="text-[11px] leading-relaxed text-neutral-500">
                    Use verification and sending controls before outreach is sent.
                  </p>
                </div>
              </div>
            </div>

            <div className="border-t border-white/10 p-8 sm:border-l sm:border-t-0 sm:p-12">
              <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.14em] text-neutral-500">
                LinkedIn safety
              </p>
              <h3 className="mb-4 text-3xl font-extrabold leading-tight tracking-[-0.02em] text-white sm:text-4xl">
                Work with signals, not spam.
              </h3>
              <p className="mb-6 text-sm leading-relaxed text-neutral-400">
                LeadGennie can incorporate LinkedIn activity into the workflow, from connection actions and
                follow-ups to likes, comments and intent signals.
              </p>
              <div className="flex items-start gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-4">
                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/10 text-emerald-400">
                  <Check className="h-3.5 w-3.5" />
                </div>
                <div>
                  <p className="text-[12px] font-semibold text-white">Upcoming channels stay upcoming.</p>
                  <p className="mt-1 text-[11px] text-neutral-500">
                    Phone, SMS and WhatsApp are not presented here as live product capabilities.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
