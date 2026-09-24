"use client";

import { useState } from "react";
import { ArrowRight, Check } from "lucide-react";
import BookDemoModal from "@/components/BookDemoModal";

const CHECKS = ["100 free credits", "No credit card required", "Beta access"];

export default function FinalCta() {
  const [isAccessOpen, setIsAccessOpen] = useState(false);
  const [email, setEmail] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsAccessOpen(true);
  };

  return (
    <>
      <section className="py-6">
        <div className="mx-auto max-w-6xl px-5">
          <div className="relative overflow-hidden rounded-3xl bg-neutral-900 px-8 py-14 sm:px-14">
            <div className="pointer-events-none absolute -right-24 -top-24 h-80 w-80 rounded-full bg-indigo-500/20 blur-3xl" />
            <div className="relative grid grid-cols-1 items-center gap-10 lg:grid-cols-2">
              <div>
                <p className="mb-3 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.14em] text-neutral-500">
                  <span className="h-1.5 w-1.5 rounded-full bg-indigo-500" />
                  Early access
                </p>
                <h2 className="mb-4 text-4xl font-extrabold leading-[1.02] tracking-[-0.03em] text-white sm:text-5xl">
                  Make outbound feel less manual.
                </h2>
                <p className="max-w-md text-sm leading-relaxed text-neutral-400">
                  Join the LeadGennie beta and get the first look at the workflow your team can build around
                  high-volume, personalized outbound.
                </p>
              </div>

              <div>
                <form onSubmit={handleSubmit} className="flex flex-col gap-2 rounded-xl border border-white/15 bg-white/[0.04] p-1.5 sm:flex-row">
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Enter your work email"
                    aria-label="Work email"
                    className="flex-1 rounded-lg bg-transparent px-3.5 py-3 text-sm text-white placeholder:text-neutral-500 focus:outline-none"
                  />
                  <button
                    type="submit"
                    className="inline-flex items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-indigo-500 to-violet-500 px-5 py-3 text-sm font-bold text-white transition-transform hover:-translate-y-0.5"
                  >
                    Get Early Access
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </form>
                <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-[12px] text-neutral-400">
                  {CHECKS.map((label) => (
                    <span key={label} className="flex items-center gap-1.5">
                      <Check className="h-3.5 w-3.5 text-emerald-400" />
                      {label}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <BookDemoModal isOpen={isAccessOpen} onClose={() => setIsAccessOpen(false)} initialEmail={email} />
    </>
  );
}
