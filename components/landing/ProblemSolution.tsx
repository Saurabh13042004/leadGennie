import { AlertTriangle, Check } from "lucide-react";

const SOLUTIONS = [
  { title: "Find + enrich", desc: "Use filters or prompts to define the prospects you want." },
  { title: "Use real signals", desc: "Surface funding, hiring, onboarding and other company activity." },
  { title: "Personalize", desc: "Adapt messages to the person, company and relevant context." },
  { title: "Track everything", desc: "Keep multi-channel activity, replies and lead history together." },
];

export default function ProblemSolution() {
  return (
    <section id="product" className="py-6">
      <div className="mx-auto max-w-6xl px-5">
        <div className="overflow-hidden rounded-3xl bg-neutral-900">
          <div className="grid grid-cols-1 lg:grid-cols-2">
            <div className="p-8 sm:p-12">
              <p className="mb-3 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.14em] text-neutral-500">
                <span className="h-1.5 w-1.5 rounded-full bg-indigo-500" />
                The problem
              </p>
              <h3 className="mb-4 text-3xl font-extrabold leading-tight tracking-[-0.02em] text-white sm:text-4xl">
                Outbound at scale is hard.
              </h3>
              <p className="mb-6 text-sm leading-relaxed text-neutral-400">
                Personalization is time-consuming. Signals live in different places. And once you add email and
                LinkedIn together, it gets harder to see the full story.
              </p>
              <div className="flex items-start gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-4">
                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/10 text-indigo-400">
                  <AlertTriangle className="h-3.5 w-3.5" />
                </div>
                <div>
                  <p className="text-[12px] font-semibold text-white">More volume can create more noise.</p>
                  <p className="mt-1 text-[11px] text-neutral-500">
                    LeadGennie is designed to keep context attached to the workflow.
                  </p>
                </div>
              </div>
            </div>

            <div className="border-t border-white/10 p-8 sm:border-l sm:border-t-0 sm:p-12">
              <p className="mb-3 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.14em] text-neutral-500">
                <span className="h-1.5 w-1.5 rounded-full bg-indigo-500" />
                The solution
              </p>
              <h3 className="mb-4 text-3xl font-extrabold leading-tight tracking-[-0.02em] text-white sm:text-4xl">
                One workflow for the whole motion.
              </h3>
              <p className="mb-6 text-sm leading-relaxed text-neutral-400">
                Define your audience with a prompt, enrich and qualify leads, generate hyperpersonalized messaging,
                run LinkedIn and email sequences, and keep the activity visible in one workspace.
              </p>
              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                {SOLUTIONS.map((s) => (
                  <div key={s.title} className="rounded-xl border border-white/10 bg-white/[0.03] p-3.5">
                    <div className="mb-1.5 flex items-center gap-1.5 text-[12px] font-bold text-white">
                      <Check className="h-3.5 w-3.5 text-emerald-400" />
                      {s.title}
                    </div>
                    <p className="text-[11px] leading-relaxed text-neutral-500">{s.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
