"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import BookDemoModal from "@/components/BookDemoModal";

const FREE_FEATURES = ["Explore the platform", "Build and test workflows", "No credit card required"];
const PRO_FEATURES = [
  "Email + LinkedIn workflows",
  "AI lead / campaign flows",
  "CRM + data enrichment workflows",
  "$5 per additional 500 credits",
];

export default function PricingSection() {
  const [isAccessOpen, setIsAccessOpen] = useState(false);

  return (
    <>
      <section id="pricing" className="border-t border-neutral-200 bg-neutral-50/60 py-20">
        <div className="mx-auto max-w-6xl px-5">
          <div className="mb-14 flex flex-wrap items-end justify-between gap-6">
            <div>
              <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.14em] text-neutral-400">Pricing</p>
              <h2 className="max-w-xl text-4xl font-extrabold leading-[1.03] tracking-[-0.03em] text-neutral-900 sm:text-5xl">
                Start small. Scale when the workflow proves itself.
              </h2>
            </div>
            <p className="max-w-sm text-sm leading-relaxed text-neutral-500">
              Beta pricing shown here is based on our planned plan structure and may change before general
              availability.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="rounded-2xl border border-neutral-200 bg-white p-7">
              <p className="text-sm font-bold text-neutral-900">Free</p>
              <p className="mt-3 text-4xl font-extrabold tracking-[-0.03em] text-neutral-900">$0</p>
              <p className="mt-1 text-[13px] text-neutral-500">100 credits</p>
              <div className="my-6 flex flex-col gap-2.5">
                {FREE_FEATURES.map((f) => (
                  <div key={f} className="flex items-start gap-2 text-[13px] text-neutral-600">
                    <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-indigo-500" />
                    {f}
                  </div>
                ))}
              </div>
              <button
                onClick={() => setIsAccessOpen(true)}
                className="w-full rounded-xl border border-neutral-200 bg-white py-3 text-sm font-semibold text-neutral-800 transition-colors hover:border-neutral-300 hover:bg-neutral-50"
              >
                Get Early Access
              </button>
            </div>

            <div className="relative rounded-2xl border border-indigo-200 bg-white p-7 shadow-[0_0_0_1px_rgba(79,70,229,0.15),0_20px_50px_rgba(79,70,229,0.08)]">
              <span className="absolute right-6 top-6 rounded-full bg-indigo-50 px-2.5 py-1 text-[10px] font-semibold text-indigo-600 ring-1 ring-inset ring-indigo-200">
                Beta plan
              </span>
              <p className="text-sm font-bold text-neutral-900">Pro</p>
              <p className="mt-3 text-4xl font-extrabold tracking-[-0.03em] text-neutral-900">
                $50<span className="text-base font-medium text-neutral-400"> / month / user</span>
              </p>
              <p className="mt-1 text-[13px] text-neutral-500">5,000 credits included</p>
              <div className="my-6 flex flex-col gap-2.5">
                {PRO_FEATURES.map((f) => (
                  <div key={f} className="flex items-start gap-2 text-[13px] text-neutral-600">
                    <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-indigo-500" />
                    {f}
                  </div>
                ))}
              </div>
              <button
                onClick={() => setIsAccessOpen(true)}
                className="w-full rounded-xl bg-neutral-900 py-3 text-sm font-semibold text-white transition-colors hover:bg-neutral-800"
              >
                Get Early Access
              </button>
            </div>
          </div>

          <div className="mt-4 rounded-xl border border-neutral-200 bg-white p-4.5 text-[13px] text-neutral-500">
            <span className="font-bold text-neutral-800">Enterprise / custom</span> · Contact us to discuss
            higher-volume requirements and workflow needs. Enterprise pricing is not finalized yet.
          </div>
        </div>
      </section>

      <BookDemoModal isOpen={isAccessOpen} onClose={() => setIsAccessOpen(false)} />
    </>
  );
}
