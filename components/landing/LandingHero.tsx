"use client";

import { useState } from "react";
import Link from "next/link";
import { Caveat } from "next/font/google";
import { ArrowRight, Check } from "lucide-react";
import BookDemoModal from "@/components/BookDemoModal";
import DashboardMockup from "./DashboardMockup";

const caveat = Caveat({ subsets: ["latin"], weight: "600" });

const PILLS = ["Prompt-driven lead filters", "Email + LinkedIn", "AI-built workflows"];

export default function LandingHero() {
  const [isAccessOpen, setIsAccessOpen] = useState(false);

  return (
    <>
      <section className="relative overflow-hidden px-5 pb-10 pt-16 md:pt-20">
        <div className="pointer-events-none absolute -right-40 -top-40 -z-10 h-[520px] w-[520px] rounded-full bg-[conic-gradient(from_140deg,rgba(99,102,241,0.16),rgba(217,70,239,0.12),rgba(56,189,248,0.14),rgba(99,102,241,0.16))] blur-3xl" />
        <div className="pointer-events-none absolute -left-32 top-72 -z-10 h-72 w-72 rounded-full bg-indigo-100/70 blur-3xl" />

        <div className="mx-auto grid max-w-6xl items-center gap-14 lg:grid-cols-[1.02fr_0.98fr]">
          <div>
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-neutral-200 bg-white px-3 py-1 text-[11px] font-bold uppercase tracking-[0.12em] text-neutral-500">
              <span className="h-1.5 w-1.5 rounded-full bg-indigo-500 shadow-[0_0_0_4px_rgba(79,70,229,0.12)]" />
              AI-led GTM for SMB outbound
            </div>

            <h1 className="mb-7 max-w-xl text-[52px] font-extrabold leading-[0.98] tracking-[-0.03em] text-neutral-900 sm:text-[64px]">
              Find the right leads.
              <br />
              <span className="text-indigo-600">Reach them with context.</span>
            </h1>

            <p className="mb-8 max-w-lg text-lg leading-relaxed text-neutral-500">
              LeadGennie helps SMB teams run high-volume outbound with hyperpersonalization across email and
              LinkedIn, while keeping outreach organized and sender reputation protected.
            </p>

            <div className="mb-4 flex flex-wrap items-center gap-3">
              <button
                onClick={() => setIsAccessOpen(true)}
                className="inline-flex items-center gap-2 rounded-xl bg-neutral-900 px-6 py-3.5 text-sm font-bold text-white shadow-[0_10px_30px_rgba(20,20,20,0.18)] transition-transform hover:-translate-y-0.5 hover:bg-neutral-800"
              >
                Get Early Access
                <ArrowRight className="h-4 w-4" />
              </button>
              <Link
                href="/#how"
                className="inline-flex items-center gap-2 rounded-xl border border-neutral-200 bg-white px-6 py-3.5 text-sm font-semibold text-neutral-800 transition-colors hover:border-neutral-300 hover:bg-neutral-50"
              >
                See how it works
                <span aria-hidden>↘</span>
              </Link>
            </div>

            <p className="mb-6 text-[13px] text-neutral-500">
              No credit card required · 100 free credits on signup
            </p>

            <div className="flex flex-wrap gap-x-5 gap-y-2 text-[13px] text-neutral-500">
              {PILLS.map((label) => (
                <span key={label} className="flex items-center gap-1.5">
                  <Check className="h-3.5 w-3.5 text-emerald-500" />
                  {label}
                </span>
              ))}
            </div>
          </div>

          <div className="relative hidden pt-14 lg:block">
            <p
              className={`${caveat.className} absolute -top-3 left-4 z-10 -rotate-3 text-2xl text-neutral-400`}
            >
              this is what your team sees ✦
            </p>
            <svg className="absolute left-6 top-9 z-10 h-10 w-16 text-neutral-300" viewBox="0 0 64 40" fill="none">
              <path
                d="M4 4C18 4 34 10 42 22C46 28 48 32 50 36"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeDasharray="1 6"
              />
              <path d="M50 36L42 33M50 36L47 28" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>

            <DashboardMockup />
          </div>
        </div>
      </section>

      <BookDemoModal isOpen={isAccessOpen} onClose={() => setIsAccessOpen(false)} />
    </>
  );
}
