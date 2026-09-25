"use client";

import { useState } from "react";
import Link from "next/link";
import { Caveat } from "next/font/google";
import { ArrowDown, ArrowRight, CheckCircle } from "@phosphor-icons/react/ssr";
import BookDemoModal from "@/components/BookDemoModal";
import Button, { buttonClasses } from "@/components/ui/Button";
import DashboardMockup from "./DashboardMockup";
import { AiChip, Container } from "./LandingPrimitives";

const caveat = Caveat({ subsets: ["latin"], weight: "600" });

const PILLS = ["Prompt-driven lead filters", "Email + LinkedIn", "AI-built workflows"];

export default function LandingHero() {
  const [isAccessOpen, setIsAccessOpen] = useState(false);

  return (
    <>
      <section className="relative -mt-16 overflow-hidden pb-14 pt-28 md:pb-20 md:pt-32">
        {/* Background: faint grid fading out + soft accent wash */}
        <div className="pointer-events-none absolute inset-0 -z-10 bg-[linear-gradient(to_right,rgba(0,0,0,0.035)_1px,transparent_1px),linear-gradient(to_bottom,rgba(0,0,0,0.035)_1px,transparent_1px)] bg-[size:56px_56px] [mask-image:radial-gradient(ellipse_70%_55%_at_50%_0%,black,transparent)]" />
        <div className="pointer-events-none absolute left-1/2 top-0 -z-10 h-[520px] w-[900px] -translate-x-1/2 rounded-full bg-[radial-gradient(ellipse_at_center,rgba(99,102,241,0.12),transparent_65%)] blur-2xl" />

        <Container>
          <div className="mx-auto flex max-w-4xl flex-col items-center text-center">
            <span className="mb-6 inline-flex h-7 items-center gap-2 rounded-full bg-white pl-1.5 pr-3 text-[12px] font-medium text-neutral-600 shadow-[0_1px_2px_rgba(0,0,0,0.04)] ring-1 ring-inset ring-neutral-200/80">
              <AiChip />
              AI-led GTM for SMB outbound
            </span>

            <h1 className="text-balance text-[40px] font-semibold leading-[1.02] tracking-[-0.035em] text-neutral-950 sm:text-[52px] md:text-[64px]">
              Find the right leads.
              <br />
              <span className="text-indigo-600">Reach them with context.</span>
            </h1>

            <p className="mt-5 max-w-xl text-[16px] leading-relaxed text-neutral-600 md:text-[18px]">
              LeadGennie helps SMB teams run high-volume outbound with hyperpersonalization across email and
              LinkedIn, while keeping outreach organized and sender reputation protected.
            </p>

            <div className="mt-8 flex w-full flex-col items-stretch gap-2.5 sm:w-auto sm:flex-row sm:items-center">
              <Button variant="primary" size="md" className="h-11 px-5 text-[15px]" onClick={() => setIsAccessOpen(true)}>
                Get Early Access
                <ArrowRight className="h-4 w-4" weight="bold" />
              </Button>
              <Link href="/#how" className={buttonClasses({ variant: "secondary", size: "md", className: "h-11 px-5 text-[15px]" })}>
                See how it works
                <ArrowDown className="h-4 w-4 text-neutral-400" weight="bold" />
              </Link>
            </div>

            <p className="mt-4 text-[13px] text-neutral-500">No credit card required · 100 free credits on signup</p>

            <ul className="mt-6 flex flex-wrap justify-center gap-x-5 gap-y-2 text-[13px] text-neutral-600">
              {PILLS.map((label) => (
                <li key={label} className="flex items-center gap-1.5">
                  <CheckCircle className="h-4 w-4 text-emerald-500" weight="fill" />
                  {label}
                </li>
              ))}
            </ul>
          </div>

          <div className="relative mt-16 md:mt-[4.5rem]">
            <div className="pointer-events-none absolute -top-14 left-2 z-10 hidden items-start lg:flex" aria-hidden>
              <p className={`${caveat.className} -rotate-3 text-[26px] leading-none text-neutral-500`}>this is what your team sees ✦</p>
              <svg className="ml-1 mt-3 h-12 w-16 text-neutral-400" viewBox="0 0 64 48" fill="none">
                <path d="M4 6C22 4 40 12 46 26C49 33 50 38 51 43" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeDasharray="1 6" />
                <path d="M51 43L44 38M51 43L54 35" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <DashboardMockup />
          </div>
        </Container>
      </section>

      <BookDemoModal isOpen={isAccessOpen} onClose={() => setIsAccessOpen(false)} />
    </>
  );
}
