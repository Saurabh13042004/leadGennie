import { Eye, ShieldCheck, Sparkles } from "lucide-react";

const PILLARS = [
  {
    icon: Sparkles,
    title: "Evidence-backed",
    desc: "Every claim in a message is grounded in verified research on the prospect — never a guess.",
  },
  {
    icon: ShieldCheck,
    title: "Approval-gated",
    desc: "Nothing sends on its own. AI drafts, you approve, and only then does it go out.",
  },
  {
    icon: Eye,
    title: "Actually counted",
    desc: "Sends, replies and suppressions reflect what really happened — never estimated.",
  },
];

export default function ResultsBand() {
  return (
    <section className="py-6">
      <div className="mx-auto max-w-6xl px-5">
        <div className="rounded-3xl bg-neutral-900 px-8 py-14 sm:px-14">
          <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.14em] text-neutral-500">Why LeadGennie</p>
          <h2 className="mb-12 max-w-2xl text-3xl font-extrabold leading-tight tracking-[-0.02em] text-white sm:text-4xl">
            Built so every send is something you&apos;d stand behind.
          </h2>

          <div className="grid grid-cols-1 gap-8 sm:grid-cols-3">
            {PILLARS.map((pillar) => (
              <div key={pillar.title}>
                <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-white/10 text-white">
                  <pillar.icon className="h-4.5 w-4.5" />
                </div>
                <h3 className="mb-2 text-base font-bold text-white">{pillar.title}</h3>
                <p className="text-sm leading-relaxed text-neutral-400">{pillar.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
