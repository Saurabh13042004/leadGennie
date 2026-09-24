import { Mail, RefreshCw, UserPlus } from "lucide-react";

const CHIPS_1 = ["Industry · SaaS", "Region · India", "Size · 50–500", "Hiring · Sales"];
const CHIPS_2 = ["Email", "LinkedIn", "Intent: Hiring"];

const FLOW_ROWS = [
  { icon: UserPlus, title: "Connect", desc: "Wait for acceptance" },
  { icon: Mail, title: "Send email", desc: "Personalized from context" },
  { icon: RefreshCw, title: "Follow up", desc: "Stop when the lead replies" },
];

export default function ProductSurface() {
  return (
    <section id="solutions" className="border-t border-neutral-200 bg-neutral-50/60 py-20">
      <div className="mx-auto max-w-6xl px-5">
        <div className="mb-14 flex flex-wrap items-end justify-between gap-6">
          <div>
            <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.14em] text-neutral-400">Product surface</p>
            <h2 className="max-w-2xl text-4xl font-extrabold leading-[1.03] tracking-[-0.03em] text-neutral-900 sm:text-5xl">
              The work your GTM team actually does.
            </h2>
          </div>
          <p className="max-w-sm text-sm leading-relaxed text-neutral-500">
            No fake benchmarks. No placeholder customer logos. The UI focuses on the workflows that exist in the
            beta.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <article className="flex min-h-[320px] flex-col justify-between rounded-2xl border border-neutral-200 bg-white p-6">
            <div>
              <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.1em] text-indigo-500">
                01 · Prospecting
              </p>
              <h3 className="mb-2 text-xl font-bold tracking-tight text-neutral-900">Prompt-driven lead filters</h3>
              <p className="text-sm leading-relaxed text-neutral-500">
                Describe the audience in plain language and use the resulting filters in the dashboard.
              </p>
            </div>
            <div className="mt-5 rounded-xl border border-neutral-200 bg-neutral-50 p-3.5">
              <p className="mb-1.5 text-[9px] text-neutral-400">Prompt</p>
              <p className="rounded-lg border border-neutral-200 bg-white p-2.5 text-[11px] leading-relaxed text-neutral-700">
                SaaS companies in India, 50–500 employees, hiring sales leaders
                <span className="ml-0.5 inline-block h-3 w-px animate-pulse bg-indigo-500 align-middle" />
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {CHIPS_1.map((chip) => (
                  <span
                    key={chip}
                    className="rounded-full border border-neutral-200 bg-white px-2 py-1 text-[9px] text-neutral-500"
                  >
                    {chip}
                  </span>
                ))}
              </div>
            </div>
          </article>

          <article className="flex min-h-[320px] flex-col justify-between rounded-2xl border border-neutral-200 bg-white p-6">
            <div>
              <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.1em] text-indigo-500">
                02 · Personalization
              </p>
              <h3 className="mb-2 text-xl font-bold tracking-tight text-neutral-900">Context-aware outreach</h3>
              <p className="text-sm leading-relaxed text-neutral-500">
                Use lead, company and intent context to create relevant email and LinkedIn touchpoints at volume.
              </p>
            </div>
            <div className="mt-5 rounded-xl border border-neutral-200 bg-neutral-50 p-3.5">
              <div className="mb-1.5 flex items-center justify-between">
                <p className="text-[9px] text-neutral-400">Draft</p>
                <span className="rounded-full bg-emerald-50 px-1.5 py-0.5 text-[8px] font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-200">
                  Personalized
                </span>
              </div>
              <p className="rounded-lg border border-neutral-200 bg-white p-2.5 text-[11px] italic leading-relaxed text-neutral-700">
                &ldquo;Saw the recent hiring push on your revenue team. Worth sharing how other SMB GTM teams…&rdquo;
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {CHIPS_2.map((chip) => (
                  <span
                    key={chip}
                    className="rounded-full border border-neutral-200 bg-white px-2 py-1 text-[9px] text-neutral-500"
                  >
                    {chip}
                  </span>
                ))}
              </div>
            </div>
          </article>

          <article className="flex min-h-[320px] flex-col justify-between rounded-2xl border border-neutral-200 bg-white p-6">
            <div>
              <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.1em] text-indigo-500">
                03 · Multi-channel
              </p>
              <h3 className="mb-2 text-xl font-bold tracking-tight text-neutral-900">Email + LinkedIn campaigns</h3>
              <p className="text-sm leading-relaxed text-neutral-500">
                Build the whole sequence in one flow, including connection steps, messages, follow-ups and response
                handling.
              </p>
            </div>
            <div className="mt-5 flex flex-col gap-2">
              {FLOW_ROWS.map((row) => (
                <div
                  key={row.title}
                  className="flex items-center gap-2.5 rounded-xl border border-neutral-200 bg-neutral-50 p-3"
                >
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-neutral-200 bg-white text-neutral-600">
                    <row.icon className="h-3.5 w-3.5" />
                  </div>
                  <div>
                    <p className="text-[11px] font-bold text-neutral-800">{row.title}</p>
                    <p className="text-[10px] text-neutral-500">{row.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </article>
        </div>
      </div>
    </section>
  );
}
