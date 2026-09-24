"use client";

import { useState } from "react";
import Link from "next/link";
import { Caveat } from "next/font/google";
import { ArrowRight, Check, Play } from "lucide-react";
import BookDemoModal from "@/components/BookDemoModal";
import DashboardMockup from "./DashboardMockup";

const caveat = Caveat({ subsets: ["latin"], weight: "600" });

const CHECKS = ["No credit card required", "Set up in minutes", "Free during early access"];

export default function LandingHero() {
  const [isBookDemoOpen, setIsBookDemoOpen] = useState(false);

  return (
    <>
      <section className="relative overflow-hidden px-5 pb-10 pt-16 md:pt-20">
        <div className="mx-auto grid max-w-6xl items-center gap-14 lg:grid-cols-[1.02fr_0.98fr]">
          <div>
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-neutral-200 bg-white px-3 py-1 text-[11px] font-bold uppercase tracking-[0.12em] text-neutral-500">
              <span className="h-1.5 w-1.5 rounded-full bg-indigo-500 shadow-[0_0_0_4px_rgba(79,70,229,0.12)]" />
              AI-powered outbound
            </div>

            <h1 className="mb-7 max-w-xl text-[52px] font-extrabold leading-[0.98] tracking-[-0.03em] text-neutral-900 sm:text-[64px]">
              Find leads.
              <br />
              Start conversations.
              <br />
              <span className="text-indigo-600">Close revenue.</span>
            </h1>

            <p className="mb-8 max-w-lg text-lg leading-relaxed text-neutral-500">
              LeadGennie finds the right prospects, researches them, and drafts personalized outreach for your
              approval — so your team spends time closing, not on repetitive busywork.
            </p>

            <div className="mb-6 flex flex-wrap items-center gap-3">
              <Link
                href="/signup"
                className="inline-flex items-center gap-2 rounded-xl bg-neutral-900 px-6 py-3.5 text-sm font-bold text-white shadow-[0_10px_30px_rgba(20,20,20,0.18)] transition-transform hover:-translate-y-0.5 hover:bg-neutral-800"
              >
                Get started free
                <ArrowRight className="h-4 w-4" />
              </Link>
              <button
                onClick={() => setIsBookDemoOpen(true)}
                className="inline-flex items-center gap-2 rounded-xl border border-neutral-200 bg-white px-6 py-3.5 text-sm font-semibold text-neutral-800 transition-colors hover:border-neutral-300 hover:bg-neutral-50"
              >
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-neutral-100">
                  <Play className="h-2.5 w-2.5 fill-neutral-700 text-neutral-700" />
                </span>
                Book a demo
              </button>
            </div>

            <div className="flex flex-wrap gap-x-6 gap-y-2 text-[13px] text-neutral-500">
              {CHECKS.map((label) => (
                <span key={label} className="flex items-center gap-1.5">
                  <Check className="h-3.5 w-3.5 text-emerald-500" />
                  {label}
                </span>
              ))}
            </div>
          </div>

          <div className="relative hidden pt-16 lg:block">
            <p
              className={`${caveat.className} absolute -top-6 right-0 z-10 -rotate-6 text-2xl leading-tight text-neutral-400`}
            >
              Less busywork.
              <br />
              More pipeline.
            </p>
            <svg className="absolute right-24 top-8 z-10 h-16 w-14 text-neutral-300" viewBox="0 0 56 64" fill="none">
              <path
                d="M6 4C10 22 18 40 34 56M34 56L22 50M34 56L30 42"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>

            <DashboardMockup />
          </div>
        </div>
      </section>

      <BookDemoModal isOpen={isBookDemoOpen} onClose={() => setIsBookDemoOpen(false)} />
    </>
  );
}
