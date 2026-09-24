import Link from "next/link";
import { ArrowRight, BarChart3, Layers, Mail, RefreshCw, Sliders, Zap } from "lucide-react";

const FEATURES = [
  {
    icon: Zap,
    title: "AI Prospecting",
    desc: "Find the right leads with real-time firmographics, intent signals and custom filters.",
  },
  {
    icon: Mail,
    title: "Personalized Outreach",
    desc: "Every message is drafted from verified research on the prospect — you approve before it sends.",
  },
  {
    icon: Layers,
    title: "Multi-Channel Sequences",
    desc: "Build sequences across email and LinkedIn, with wait times between touches.",
  },
  {
    icon: BarChart3,
    title: "Analytics",
    desc: "Track sends, replies and suppressions — counted from what happened, never estimated.",
  },
  {
    icon: RefreshCw,
    title: "Integrations",
    desc: "Connect HubSpot today, with more CRM connectors on the roadmap.",
  },
  {
    icon: Sliders,
    title: "Custom Workflows",
    desc: "Tailor sequences, rules and triggers to your own GTM motion.",
  },
];

export default function FeatureGrid() {
  return (
    <section id="features" className="border-t border-neutral-200 bg-neutral-50/60 py-20">
      <div className="mx-auto max-w-6xl px-5">
        <div className="mb-12 flex flex-wrap items-end justify-between gap-6">
          <div>
            <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.14em] text-neutral-400">Platform</p>
            <h2 className="max-w-xl text-4xl font-extrabold leading-[1.03] tracking-[-0.03em] text-neutral-900 sm:text-5xl">
              More pipeline. Less manual work.
            </h2>
            <p className="mt-4 max-w-md text-[15px] leading-relaxed text-neutral-500">
              Whether you&apos;re a founder, SDR, or revenue team, LeadGennie helps you scale outbound without the
              busywork.
            </p>
          </div>
          <Link
            href="/signup"
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-indigo-600 hover:text-indigo-700"
          >
            Explore all features
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((feature) => (
            <div
              key={feature.title}
              className="rounded-2xl border border-neutral-200 bg-white p-6 transition-colors hover:border-neutral-300"
            >
              <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-neutral-900 text-white">
                <feature.icon className="h-4.5 w-4.5" />
              </div>
              <h3 className="mb-2 text-[15px] font-bold tracking-tight text-neutral-900">{feature.title}</h3>
              <p className="text-sm leading-relaxed text-neutral-500">{feature.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
