"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";
import BookDemoModal from "@/components/BookDemoModal";

const CHECKS = ["No credit card required", "Free during early access", "Full feature access"];

export default function FinalCta() {
  const [isBookDemoOpen, setIsBookDemoOpen] = useState(false);

  return (
    <>
      <section className="py-20">
        <div className="mx-auto max-w-6xl px-5">
          <div className="flex flex-col items-start justify-between gap-8 border-t border-neutral-200 pt-14 sm:flex-row sm:items-end">
            <div>
              <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.14em] text-neutral-400">
                Ready to build your pipeline?
              </p>
              <h2 className="max-w-md text-4xl font-extrabold leading-[1.03] tracking-[-0.03em] text-neutral-900 sm:text-5xl">
                Start for free. See your pipeline grow.
              </h2>
            </div>

            <div className="flex flex-col items-start gap-4 sm:items-end">
              <div className="flex flex-wrap gap-3">
                <Link
                  href="/signup"
                  className="inline-flex items-center gap-2 rounded-xl bg-neutral-900 px-6 py-3.5 text-sm font-bold text-white transition-transform hover:-translate-y-0.5 hover:bg-neutral-800"
                >
                  Get started free
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <button
                  onClick={() => setIsBookDemoOpen(true)}
                  className="inline-flex items-center gap-2 rounded-xl border border-neutral-200 bg-white px-6 py-3.5 text-sm font-semibold text-neutral-800 transition-colors hover:border-neutral-300 hover:bg-neutral-50"
                >
                  Book a demo
                </button>
              </div>
              <div className="flex flex-wrap gap-x-5 gap-y-2 text-[13px] text-neutral-500">
                {CHECKS.map((label) => (
                  <span key={label} className="flex items-center gap-1.5">
                    <Check className="h-3.5 w-3.5 text-emerald-500" />
                    {label}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <BookDemoModal isOpen={isBookDemoOpen} onClose={() => setIsBookDemoOpen(false)} />
    </>
  );
}
