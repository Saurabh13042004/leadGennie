import { Calendar, FileText, Search, Send } from "lucide-react";

const STEPS = [
  {
    num: "01",
    icon: Search,
    title: "Find",
    desc: "Discover high-intent prospects using real-time signals and your ICP.",
  },
  {
    num: "02",
    icon: FileText,
    title: "Personalize",
    desc: "AI researches each prospect and drafts a message tailored to them.",
  },
  {
    num: "03",
    icon: Send,
    title: "Outreach",
    desc: "You approve, then run multi-channel sequences across email and more.",
  },
  {
    num: "04",
    icon: Calendar,
    title: "Book",
    desc: "Qualified replies land in your inbox, ready to turn into meetings.",
  },
];

export default function HowItWorksSection() {
  return (
    <section id="how-it-works" className="py-20">
      <div className="mx-auto max-w-6xl px-5">
        <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.14em] text-neutral-400">How it works</p>
        <h2 className="mb-14 max-w-2xl text-4xl font-extrabold leading-[1.03] tracking-[-0.03em] text-neutral-900 sm:text-5xl">
          From idea to booked meeting in a few steps.
        </h2>

        <div className="relative grid grid-cols-1 gap-10 sm:grid-cols-2 lg:grid-cols-4">
          <div className="absolute left-0 right-0 top-6 hidden h-px bg-neutral-200 lg:block" />

          {STEPS.map((step) => (
            <div key={step.num} className="relative">
              <div className="relative z-10 mb-5 flex h-12 w-12 items-center justify-center rounded-xl border border-neutral-200 bg-white text-neutral-700 shadow-sm">
                <step.icon className="h-5 w-5" />
              </div>
              <p className="mb-1 text-[11px] font-bold tracking-widest text-neutral-300">{step.num}</p>
              <h3 className="mb-1.5 text-lg font-bold tracking-tight text-neutral-900">{step.title}</h3>
              <p className="text-sm leading-relaxed text-neutral-500">{step.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
