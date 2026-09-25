"use client";

import { useState } from "react";
import { ArrowRight, Check, EnvelopeSimple } from "@phosphor-icons/react/ssr";
import BookDemoModal from "@/components/BookDemoModal";
import { Container, Eyebrow, LogoMark } from "./LandingPrimitives";

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
      <section className="pb-20 md:pb-28">
        <Container>
          <div className="relative overflow-hidden rounded-3xl bg-neutral-950 px-6 py-14 ring-1 ring-black/5 sm:px-12 md:py-20">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_60%_80%_at_85%_0%,rgba(99,102,241,0.28),transparent_60%),radial-gradient(ellipse_40%_60%_at_100%_100%,rgba(217,70,239,0.14),transparent_60%)]" />
            <div
              className="pointer-events-none absolute inset-0 opacity-60 [mask-image:radial-gradient(ellipse_at_top_right,black,transparent_70%)]"
              style={{ backgroundImage: "linear-gradient(to right,rgba(255,255,255,0.06) 1px,transparent 1px),linear-gradient(to bottom,rgba(255,255,255,0.06) 1px,transparent 1px)", backgroundSize: "44px 44px" }}
            />

            <div className="relative grid items-center gap-10 lg:grid-cols-[1.1fr_1fr] lg:gap-16">
              <div>
                <Eyebrow dark className="mb-4 flex items-center gap-2">
                  <LogoMark size="sm" className="ring-1 ring-white/15" />
                  Early access
                </Eyebrow>
                <h2 className="text-[34px] font-semibold leading-[1.05] tracking-[-0.03em] text-white sm:text-[44px] md:text-[52px]">
                  Make outbound feel less manual.
                </h2>
                <p className="mt-4 max-w-md text-[16px] leading-relaxed text-neutral-400">
                  Join the LeadGennie beta and get the first look at the workflow your team can build around high-volume,
                  personalized outbound.
                </p>
              </div>

              <div>
                <form onSubmit={handleSubmit} className="flex flex-col gap-2 rounded-xl bg-white/[0.06] p-1.5 ring-1 ring-inset ring-white/15 sm:flex-row">
                  <label className="flex min-w-0 flex-1 items-center gap-2.5 px-3">
                    <EnvelopeSimple className="h-4 w-4 shrink-0 text-neutral-500" weight="duotone" />
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="Enter your work email"
                      aria-label="Work email"
                      className="h-10 w-full min-w-0 bg-transparent text-[14px] text-white placeholder:text-neutral-500 focus:outline-none"
                    />
                  </label>
                  <button
                    type="submit"
                    className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-lg bg-white px-4 text-[14px] font-medium text-neutral-950 shadow-[0_1px_2px_rgba(0,0,0,0.2)] transition-colors hover:bg-neutral-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/60"
                  >
                    Get Early Access
                    <ArrowRight className="h-4 w-4" weight="bold" />
                  </button>
                </form>
                <ul className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-[13px] text-neutral-400">
                  {CHECKS.map((label) => (
                    <li key={label} className="flex items-center gap-1.5">
                      <Check className="h-3.5 w-3.5 text-emerald-400" weight="bold" />
                      {label}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </Container>
      </section>

      <BookDemoModal isOpen={isAccessOpen} onClose={() => setIsAccessOpen(false)} initialEmail={email} />
    </>
  );
}
